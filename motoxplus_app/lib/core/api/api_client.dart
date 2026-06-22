import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const String kBaseUrl = 'https://motoxplus.vercel.app/api';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: kBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            final token = await _storage.read(key: 'access_token');
            final opts = error.requestOptions;
            opts.headers['Authorization'] = 'Bearer $token';
            try {
              final res = await _dio.fetch(opts);
              handler.resolve(res);
              return;
            } catch (_) {}
          }
          await _storage.deleteAll();
        }
        handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;

  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) return false;

      final res = await Dio().post(
        '$kBaseUrl/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      if (res.statusCode == 200) {
        await _storage.write(key: 'access_token', value: res.data['accessToken']);
        if (res.data['refreshToken'] != null) {
          await _storage.write(key: 'refresh_token', value: res.data['refreshToken']);
        }
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<void> saveTokens(String accessToken, String refreshToken) async {
    await _storage.write(key: 'access_token', value: accessToken);
    await _storage.write(key: 'refresh_token', value: refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.deleteAll();
  }

  Future<String?> getAccessToken() => _storage.read(key: 'access_token');
}
