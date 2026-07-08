//
//  VisitorCallBridge.m
//  kamalSociety
//
//  Registers the Swift VisitorCallBridge class as a React Native module
//  named "VisitorCallBridge". The actual implementation lives in
//  VisitorCallBridge.swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(VisitorCallBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(getVoipToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(consumePendingCallEvents:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endActiveCall:(NSString *)visitorId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(simulateIncomingCall:(NSDictionary *)payload
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
