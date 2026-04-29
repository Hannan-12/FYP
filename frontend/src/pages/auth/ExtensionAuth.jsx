import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../firebase/config";

const ExtensionAuth = () => {
  const [status, setStatus] = useState("Opening Google sign-in...");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get("redirect_uri");

    if (!redirectUri) {
      setError("Missing redirect_uri. Please try signing in again from VS Code.");
      return;
    }

    signInWithPopup(auth, googleProvider)
      .then(async (result) => {
        const idToken = await result.user.getIdToken();
        setStatus("Success! Returning to VS Code...");
        window.location.href = `${decodeURIComponent(redirectUri)}?idToken=${encodeURIComponent(idToken)}`;
      })
      .catch((err) => {
        if (err.code === "auth/popup-closed-by-user") {
          setError("Sign-in popup was closed. You can close this tab and try again.");
        } else {
          setError(`Sign-in failed: ${err.message}`);
        }
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="text-center p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-white mb-2">DevSkill Tracker</h1>
        <p className="text-slate-400 text-sm mb-8">VS Code Extension Sign-In</p>

        {error ? (
          <div>
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-sm">
              {error}
            </div>
            <button
              onClick={() => window.close()}
              className="text-slate-400 hover:text-white underline text-sm"
            >
              Close this tab
            </button>
          </div>
        ) : (
          <div>
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">{status}</p>
            <p className="text-slate-500 text-xs mt-2">
              A Google sign-in popup should have appeared. If not, check your popup blocker.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtensionAuth;
