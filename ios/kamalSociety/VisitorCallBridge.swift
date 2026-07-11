//
//  VisitorCallBridge.swift
//  kamalSociety
//
//  React Native bridge for VisitorCallManager. Exposes the VoIP push token
//  and emits events when a CallKit call is accepted / declined so the JS
//  side can run the existing approve/deny flow.
//

import Foundation
import React

@objc(VisitorCallBridge)
final class VisitorCallBridge: RCTEventEmitter, VisitorCallManagerDelegate {

    private static weak var sharedInstance: VisitorCallBridge?
    private var hasListeners = false

    private struct BufferedEvent {
        let name: String
        let body: [String: Any]
    }
    private var pendingEvents: [BufferedEvent] = []

    override init() {
        super.init()
        VisitorCallBridge.sharedInstance = self
        VisitorCallManager.shared.delegate = self
    }

    override class func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return [
            "VisitorCallVoipTokenUpdated",
            "VisitorCallAccepted",
            "VisitorCallDeclined",
        ]
    }

    override func startObserving() {
        hasListeners = true
        // Re-emit the latest token so JS doesn't need to poll.
        if let token = VisitorCallManager.shared.currentVoipToken() {
            sendEvent(withName: "VisitorCallVoipTokenUpdated", body: ["token": token])
        }
        // Drain any events that arrived between bridge init and JS listener
        // attach (this happens on cold launches triggered by a VoIP push).
        let drain = pendingEvents
        pendingEvents.removeAll()
        for event in drain {
            sendEvent(withName: event.name, body: event.body)
        }
    }

    override func stopObserving() {
        hasListeners = false
    }

    private func emit(name: String, body: [String: Any]) {
        if hasListeners {
            sendEvent(withName: name, body: body)
        } else {
            pendingEvents.append(BufferedEvent(name: name, body: body))
        }
    }

    // MARK: - Bridge methods

    @objc(getVoipToken:rejecter:)
    func getVoipToken(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        let token = VisitorCallManager.shared.currentVoipToken()
        resolve(token as Any)
    }

    @objc(consumePendingCallEvents:rejecter:)
    func consumePendingCallEvents(_ resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(VisitorCallManager.shared.consumePendingCallEvents())
    }

    @objc(endActiveCall:resolver:rejecter:)
    func endActiveCall(_ visitorId: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        VisitorCallManager.shared.endActiveCall(forVisitorId: visitorId)
        resolve(nil)
    }

    @objc(simulateIncomingCall:resolver:rejecter:)
    func simulateIncomingCall(_ payload: NSDictionary,
                              resolver resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
        let dict = (payload as? [String: Any]) ?? [:]
        DispatchQueue.main.async {
            VisitorCallManager.shared.simulateIncomingCall(payload: dict)
        }
        resolve(nil)
    }

    // MARK: - VisitorCallManagerDelegate

    func visitorCallManagerDidUpdate(token: String) {
        emit(name: "VisitorCallVoipTokenUpdated", body: ["token": token])
    }

    func visitorCallManagerCallAccepted(payload: [String: Any]) {
        emit(name: "VisitorCallAccepted", body: payload)
    }

    func visitorCallManagerCallDeclined(payload: [String: Any]) {
        emit(name: "VisitorCallDeclined", body: payload)
    }
}
