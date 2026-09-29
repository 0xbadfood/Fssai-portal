import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:pdfrx/pdfrx.dart';

import 'core/session.dart';
import 'core/store.dart';
import 'router.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  pdfrxFlutterInitialize();
  await initializeDateFormatting('en_IN');
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));
  runApp(const MyFoodLicenseApp());
  store.loadConfig();
  await session.restore();
}

class MyFoodLicenseApp extends StatefulWidget {
  const MyFoodLicenseApp({super.key});
  @override
  State<MyFoodLicenseApp> createState() => _MyFoodLicenseAppState();
}

class _MyFoodLicenseAppState extends State<MyFoodLicenseApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Going to the background saves details still being typed (the web does this on pagehide).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) store.flushDraft();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'MyFoodLicense',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: router,
      builder: (context, child) {
        final mq = MediaQuery.of(context);
        return MediaQuery(data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.2)), child: child!);
      },
    );
  }
}
