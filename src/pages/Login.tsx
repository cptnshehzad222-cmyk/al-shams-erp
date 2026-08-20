import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

const LOGIN_USERNAME = "muhammad";
const LOGIN_PASSWORD = "hamad2002";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);

    // Check login credentials
    if (
      username.trim() === LOGIN_USERNAME &&
      password === LOGIN_PASSWORD
    ) {
      // Save login session
      localStorage.setItem("alshams_erp_logged_in", "true");
      localStorage.setItem("alshams_erp_username", username.trim());

      // Notify App.tsx that authentication status changed
      window.dispatchEvent(new Event("alshams-auth-change"));

      // Go to ERP dashboard
      navigate("/", { replace: true });
    } else {
      setError("Invalid username or password.");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="login-glow login-glow-one"></div>
        <div className="login-glow login-glow-two"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            AS
          </div>

          <h1>AL SHAMS ERP</h1>

          <p>Management & Accounting System</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {/* USERNAME */}
          <div className="login-field">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>

          {/* PASSWORD */}
          <div className="login-field">
            <label htmlFor="password">
              Password
            </label>

            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
              />

              <button
                type="button"
                className="show-password-button"
                onClick={() =>
                  setShowPassword((prev) => !prev)
                }
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "LOGIN"}
          </button>
        </form>

        <div className="login-footer">
          <span>AL SHAMS AL GHAYABA TRD EST.</span>
          <span>© 2026</span>
        </div>
      </div>
    </div>
  );
}

export default Login;