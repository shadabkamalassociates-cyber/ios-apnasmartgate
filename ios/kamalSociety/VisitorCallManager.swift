//
//  VisitorCallManager.swift
//  kamalSociety
//
//  Receives VoIP pushes (PushKit) and surfaces them as native incoming calls
//  via CallKit. This is the iOS equivalent of the Android VisitorAlertActivity:
//  it makes the device ring continuously and shows a full-screen UI even on
//  the lock screen, until the user taps Accept or Decline.
//
//  Backend integration:
//   - Register the VoIP push token (returned via VisitorCallBridge.getVoipToken)
//     against the resident the same way the FCM token is stored today.
//   - To trigger a ring, send a VoIP push to that token with payload:
//       {
//         "visitorId": "<id>",
//         "name": "John Doe",
//         "phone": "+91...",       // optional
//         "flat": "A-101",         // optional
//         "vehicle": "DL-1234",    // optional
//         "title": "Visitor Entry Request",   // optional, override
//         "body":  "John Doe is waiting at the gate" // optional, override
//       }
//     Use header  apns-push-type: voip,  apns-topic: <bundleId>.voip,
//     apns-priority: 10.
//

import Foundation
import PushKit
import CallKit
import UIKit

@objc public protocol VisitorCallManagerDelegate: AnyObject {
    func visitorCallManagerDidUpdate(token: String)
    func visitorCallManagerCallAccepted(payload: [String: Any])
    func visitorCallManagerCallDeclined(payload: [String: Any])
}

@objc(VisitorCallManager)
public final class VisitorCallManager: NSObject {

    // MARK: - Singleton

    @objc public static let shared = VisitorCallManager()

    // MARK: - Delegate

    public weak var delegate: VisitorCallManagerDelegate? {
        didSet {
            // Drain any events that fired before a delegate was attached.
            flushBufferedEvents()
        }
    }

    // MARK: - State

    private let voipRegistry: PKPushRegistry
    private let callProvider: CXProvider
    private let callController = CXCallController()

    private struct PendingCall {
        let uuid: UUID
        let visitorId: String
        let name: String
        let phone: String?
        let flat: String?
        let vehicle: String?
        let title: String?
        let body: String?
        var answered: Bool
    }

    private var pendingCalls: [UUID: PendingCall] = [:]
    private var pendingCallByVisitorId: [String: UUID] = [:]
    private var voipToken: String?

    private enum BufferedEvent {
        case tokenUpdated(String)
        case accepted([String: Any])
        case declined([String: Any])
    }
    private var bufferedEvents: [BufferedEvent] = []

    // Persisted between launches so an action taken from a CallKit screen
    // while the JS bundle isn't running is not silently dropped.
    private let persistedActionsKey = "VisitorCallManager.pendingActions.v1"

    // MARK: - Init

    private override init() {
        voipRegistry = PKPushRegistry(queue: .main)

        let config: CXProviderConfiguration
        if #available(iOS 14.0, *) {
            config = CXProviderConfiguration()
        } else {
            config = CXProviderConfiguration(localizedName: "AapnaSmartGate")
        }
        config.supportsVideo = false
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.includesCallsInRecents = false
        config.supportedHandleTypes = [.generic]
        // Custom incoming call ringtone. The file MUST be in the app bundle
        // (it already is, copied via Resources). CallKit loops it for as long
        // as the call screen is up, which gives the "rings until you act"
        // behavior the user wanted.
        config.ringtoneSound = "mygate.mp3"
        if let icon = UIImage(named: "AppIcon"), let data = icon.pngData() {
            config.iconTemplateImageData = data
        }

        callProvider = CXProvider(configuration: config)
        super.init()

        callProvider.setDelegate(self, queue: nil)
        voipRegistry.delegate = self
        voipRegistry.desiredPushTypes = [.voIP]
    }

    // MARK: - Public

    /// Force-init the singleton from app launch so PushKit is alive before
    /// `application(_:didFinishLaunchingWithOptions:)` returns.
    @objc public func start() {
        if let cached = currentVoipToken() {
            delegate?.visitorCallManagerDidUpdate(token: cached)
            if delegate == nil {
                bufferedEvents.append(.tokenUpdated(cached))
            }
        }
    }

    @objc public func currentVoipToken() -> String? {
        if let cached = voipToken { return cached }
        if let data = voipRegistry.pushToken(for: .voIP) {
            let hex = data.map { String(format: "%02x", $0) }.joined()
            voipToken = hex
            return hex
        }
        return nil
    }

    /// Returns events that were emitted before any JS listener was attached
    /// (e.g. user declined a call while the app was killed). The list is
    /// cleared after this call.
    @objc public func consumePendingCallEvents() -> [[String: Any]] {
        let defaults = UserDefaults.standard
        guard let raw = defaults.array(forKey: persistedActionsKey) as? [[String: Any]] else {
            return []
        }
        defaults.removeObject(forKey: persistedActionsKey)
        return raw
    }

    /// End the active CallKit call for a visitor (e.g. resident completed the
    /// approve/deny flow inside the app, but the CallKit UI is still up).
    @objc public func endActiveCall(forVisitorId visitorId: String) {
        guard let uuid = pendingCallByVisitorId[visitorId] else { return }
        let endAction = CXEndCallAction(call: uuid)
        callController.requestTransaction(with: endAction) { _ in }
    }

    /// Test helper — present a fake incoming visitor call exactly the way
    /// a real VoIP push would, so the developer can verify the CallKit
    /// experience (ringing, full-screen on lock, Accept/Decline events)
    /// without the backend. Pass any visitor metadata; missing fields fall
    /// back to sensible defaults.
    @objc public func simulateIncomingCall(payload: [String: Any]) {
        let dict = payload

        func string(_ key: String) -> String? {
            if let v = dict[key] as? String, !v.isEmpty { return v }
            if let v = dict[key] as? NSNumber { return v.stringValue }
            return nil
        }

        let visitorId = string("visitorId")
            ?? string("gatepassId")
            ?? string("requestId")
            ?? "test_\(Int(Date().timeIntervalSince1970))"
        let name = string("name") ?? "Test Visitor"
        let phone = string("phone")
        let flat = string("flat")
        let vehicle = string("vehicle")
        let title = string("title") ?? "Visitor Entry Request"
        let body = string("body") ?? "\(name) is waiting at the gate"

        let uuid = UUID()
        let pending = PendingCall(
            uuid: uuid,
            visitorId: visitorId,
            name: name,
            phone: phone,
            flat: flat,
            vehicle: vehicle,
            title: title,
            body: body,
            answered: false
        )
        pendingCalls[uuid] = pending
        pendingCallByVisitorId[visitorId] = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: name)
        update.localizedCallerName = name
        update.hasVideo = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = false

        callProvider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if let error = error {
                NSLog("[VisitorCallManager] simulateIncomingCall failed: \(error.localizedDescription)")
                self?.pendingCalls.removeValue(forKey: uuid)
                self?.pendingCallByVisitorId.removeValue(forKey: visitorId)
            }
        }
    }

    // MARK: - Internal

    private func flushBufferedEvents() {
        guard let delegate = delegate, !bufferedEvents.isEmpty else { return }
        let events = bufferedEvents
        bufferedEvents.removeAll()
        for event in events {
            switch event {
            case .tokenUpdated(let token):
                delegate.visitorCallManagerDidUpdate(token: token)
            case .accepted(let payload):
                delegate.visitorCallManagerCallAccepted(payload: payload)
            case .declined(let payload):
                delegate.visitorCallManagerCallDeclined(payload: payload)
            }
        }
    }

    private func emit(_ event: BufferedEvent) {
        if let delegate = delegate {
            switch event {
            case .tokenUpdated(let token):
                delegate.visitorCallManagerDidUpdate(token: token)
            case .accepted(let payload):
                delegate.visitorCallManagerCallAccepted(payload: payload)
            case .declined(let payload):
                delegate.visitorCallManagerCallDeclined(payload: payload)
            }
        } else {
            bufferedEvents.append(event)
        }
    }

    private func persistAction(kind: String, payload: [String: Any]) {
        var entry = payload
        entry["action"] = kind
        entry["receivedAt"] = Date().timeIntervalSince1970

        let defaults = UserDefaults.standard
        var existing = (defaults.array(forKey: persistedActionsKey) as? [[String: Any]]) ?? []
        existing.append(entry)
        // Keep the list bounded to avoid unbounded growth.
        if existing.count > 50 {
            existing = Array(existing.suffix(50))
        }
        defaults.set(existing, forKey: persistedActionsKey)
    }

    private func makePayload(for pending: PendingCall) -> [String: Any] {
        var payload: [String: Any] = [
            "visitorId": pending.visitorId,
            "name": pending.name,
        ]
        if let v = pending.phone { payload["phone"] = v }
        if let v = pending.flat { payload["flat"] = v }
        if let v = pending.vehicle { payload["vehicle"] = v }
        if let v = pending.title { payload["title"] = v }
        if let v = pending.body { payload["body"] = v }
        return payload
    }

    fileprivate func reportIncomingCall(payload: PKPushPayload, completion: @escaping () -> Void) {
        let dict = payload.dictionaryPayload as? [String: Any] ?? [:]

        func string(_ key: String) -> String? {
            if let v = dict[key] as? String, !v.isEmpty { return v }
            if let v = dict[key] as? NSNumber { return v.stringValue }
            return nil
        }

        let visitorId = string("visitorId")
            ?? string("visitor_id")
            ?? string("gatepassId")
            ?? string("gatepass_id")
            ?? string("requestId")
            ?? string("id")
            ?? UUID().uuidString
        let name = string("name") ?? string("callerName") ?? "Visitor"
        let phone = string("phone")
        let flat = string("flat") ?? string("flatNo")
        let vehicle = string("vehicle") ?? string("vehicleinfo")
        let title = string("title")
        let body = string("body")

        let uuid = UUID()
        let pending = PendingCall(
            uuid: uuid,
            visitorId: visitorId,
            name: name,
            phone: phone,
            flat: flat,
            vehicle: vehicle,
            title: title,
            body: body,
            answered: false
        )
        pendingCalls[uuid] = pending
        pendingCallByVisitorId[visitorId] = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: name)
        update.localizedCallerName = name
        update.hasVideo = false
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsDTMF = false

        callProvider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if let error = error {
                NSLog("[VisitorCallManager] reportNewIncomingCall failed: \(error.localizedDescription)")
                self?.pendingCalls.removeValue(forKey: uuid)
                self?.pendingCallByVisitorId.removeValue(forKey: visitorId)
            }
            completion()
        }
    }
}

// MARK: - PKPushRegistryDelegate

extension VisitorCallManager: PKPushRegistryDelegate {

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }
        let token = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
        voipToken = token
        emit(.tokenUpdated(token))
    }

    public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        if type == .voIP {
            voipToken = nil
        }
    }

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        // iOS 13+ requires that we synchronously report a new incoming call
        // for every VoIP push, otherwise the system terminates the app and
        // future PushKit deliveries get throttled / disabled.
        reportIncomingCall(payload: payload, completion: completion)
    }
}

// MARK: - CXProviderDelegate

extension VisitorCallManager: CXProviderDelegate {

    public func providerDidReset(_ provider: CXProvider) {
        pendingCalls.removeAll()
        pendingCallByVisitorId.removeAll()
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard var pending = pendingCalls[action.callUUID] else {
            action.fail()
            return
        }
        pending.answered = true
        pendingCalls[action.callUUID] = pending

        action.fulfill()

        let payload = makePayload(for: pending)
        emit(.accepted(payload))
        persistAction(kind: "approve", payload: payload)

        // Tear the call down — we're not actually carrying audio.
        let endAction = CXEndCallAction(call: pending.uuid)
        callController.requestTransaction(with: endAction) { _ in }
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        let uuid = action.callUUID
        defer {
            action.fulfill()
            if let removed = pendingCalls.removeValue(forKey: uuid) {
                pendingCallByVisitorId.removeValue(forKey: removed.visitorId)
            }
        }
        guard let pending = pendingCalls[uuid] else { return }
        // If the call was already answered (we requested this end ourselves),
        // don't double-emit; we already emitted .accepted in the answer path.
        if !pending.answered {
            let payload = makePayload(for: pending)
            emit(.declined(payload))
            persistAction(kind: "deny", payload: payload)
        }
    }
}
