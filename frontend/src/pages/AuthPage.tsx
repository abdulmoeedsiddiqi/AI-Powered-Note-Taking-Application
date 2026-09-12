import { useLocation, useNavigate } from 'react-router-dom';

import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode: 'login' | 'signup' = location.pathname === '/signup' ? 'signup' : 'login';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-logo" src="/favicon.svg" alt="Notebook" width={40} height={40} />
          <h1>Notebook</h1>
          <p className="auth-tagline">Write. Record. Keep.</p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
            onClick={() => navigate('/login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => navigate('/signup')}
          >
            Sign up
          </button>
        </div>

        {mode === 'login' ? <LoginForm /> : <SignupForm />}

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => navigate('/signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => navigate('/login')}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
