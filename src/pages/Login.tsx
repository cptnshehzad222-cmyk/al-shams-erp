import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LOGIN_USERNAME = "muhammad";
const LOGIN_PASSWORD = "hamad2002";

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);

    if (username.trim() === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
      localStorage.setItem("alshams_erp_logged_in", "true");
      localStorage.setItem("alshams_erp_username", username.trim());
      window.dispatchEvent(new Event("alshams-auth-change"));
      navigate("/", { replace: true });
      return;
    }

    setError("Invalid username or password.");
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">AS</div>
          <h1>AL SHAMS ERP</h1>
          <p>Management & Accounting System</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <label className="login-field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Enter username"
              disabled={loading}
              autoFocus
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="button button-primary login-button" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="login-footer">
          <span>AL SHAMS AL GHAYABA TRD EST.</span>
          <span>2026</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
