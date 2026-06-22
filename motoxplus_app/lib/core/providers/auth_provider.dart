import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/user.dart';

class AuthState {
  final User? user;
  final Dealer? dealer;
  final bool isLoading;
  final String? error;

  const AuthState({this.user, this.dealer, this.isLoading = false, this.error});

  bool get isAuthenticated => user != null;

  AuthState copyWith({User? user, Dealer? dealer, bool? isLoading, String? error}) => AuthState(
        user: user ?? this.user,
        dealer: dealer ?? this.dealer,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _api;

  AuthNotifier(this._api) : super(const AuthState());

  Future<void> loadCurrentUser() async {
    try {
      final res = await _api.dio.get('/auth/me');
      if (res.statusCode == 200) {
        final user = User.fromJson(res.data['user'] as Map<String, dynamic>);
        Dealer? dealer;
        if (res.data['dealer'] != null) {
          dealer = Dealer.fromJson(res.data['dealer'] as Map<String, dynamic>);
        }
        state = state.copyWith(user: user, dealer: dealer);
      }
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<String?> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _api.dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      if (res.statusCode == 200) {
        await _api.saveTokens(
          res.data['accessToken'] as String,
          res.data['refreshToken'] as String,
        );
        final user = User.fromJson(res.data['user'] as Map<String, dynamic>);
        Dealer? dealer;
        if (res.data['dealer'] != null) {
          dealer = Dealer.fromJson(res.data['dealer'] as Map<String, dynamic>);
        }
        state = AuthState(user: user, dealer: dealer);
        return null;
      }
    } catch (e) {
      final msg = _extractError(e);
      state = state.copyWith(isLoading: false, error: msg);
      return msg;
    }
    state = state.copyWith(isLoading: false);
    return null;
  }

  Future<void> logout() async {
    try {
      await _api.dio.post('/auth/logout');
    } catch (_) {}
    await _api.clearTokens();
    state = const AuthState();
  }

  String _extractError(dynamic e) {
    try {
      if (e is Exception) {
        final str = e.toString();
        if (str.contains('error')) return 'Invalid credentials';
      }
    } catch (_) {}
    return 'Something went wrong';
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ApiClient());
});
