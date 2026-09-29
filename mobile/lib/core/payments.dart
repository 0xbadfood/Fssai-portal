import 'dart:async';

import 'package:flutter_cashfree_pg_sdk/api/cferrorresponse/cferrorresponse.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpayment/cfwebcheckoutpayment.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfpaymentgateway/cfpaymentgatewayservice.dart';
import 'package:flutter_cashfree_pg_sdk/api/cfsession/cfsession.dart';
import 'package:flutter_cashfree_pg_sdk/utils/cfenums.dart';

import 'api.dart';

/// Pay through the gateway (Cashfree), as the web portal does: the server works out the amount and creates the
/// order ({applicationId} or {orderId}), Cashfree's checkout opens inside the app (UPI apps, cards, net banking),
/// and then the result screen asks the server, which asks Cashfree, whether it was paid. Returns the order id.
Future<String> payWithGateway(Map<String, dynamic> start) async {
  final r = await api.post('/api/payments/checkout', start);
  final orderId = r['checkout']['id'] as String;
  final done = Completer<void>();
  CFPaymentGatewayService().setCallback(
    (_) => done.isCompleted ? null : done.complete(),
    (CFErrorResponse e, String _) => done.isCompleted ? null : done.complete(),
  );
  final session = CFSessionBuilder()
      .setEnvironment(r['mode'] == 'live' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX)
      .setOrderId(orderId)
      .setPaymentSessionId(r['sessionId'] as String)
      .build();
  CFPaymentGatewayService().doPayment(CFWebCheckoutPaymentBuilder().setSession(session).build());
  // Success, failure or the customer backing out all end here; the server has the final word.
  await done.future;
  return orderId;
}
