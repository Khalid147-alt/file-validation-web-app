import { useState, useRef } from "react";

const API_URL = "http://localhost:8000/validate";

const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.mp4";

function App() {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef(null);

  const clearResult = () => {
    setResult(null);
    setError(null);
    setSubmitted(false);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    clearResult();
  };

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value);
    clearResult();
  };

  const handleValidate = async () => {
    if (!file || !description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSubmitted(false);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);

    try {
      const res = await fetch(API_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Server error (${res.status})`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || "Network error. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnyway = () => setSubmitted(true);

  const scorePercent = result ? Math.round(result.score * 100) : 0;

  const bannerColor =
    result?.status === "allowed"
      ? "#16a34a"
      : result?.status === "warning"
        ? "#ca8a04"
        : "#dc2626";

  const bannerBg =
    result?.status === "allowed"
      ? "#f0fdf4"
      : result?.status === "warning"
        ? "#fefce8"
        : "#fef2f2";

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
          background: #f3f4f6;
          color: #1f2937;
          min-height: 100vh;
        }

        .container {
          max-width: 640px;
          margin: 0 auto;
          padding: 48px 24px;
        }

        .card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
          padding: 40px 36px;
        }

        h1 {
          font-size: 1.75rem;
          font-weight: 700;
          text-align: center;
          margin-bottom: 8px;
          color: #111827;
        }

        .subtitle {
          text-align: center;
          color: #6b7280;
          font-size: 0.95rem;
          margin-bottom: 32px;
        }

        label {
          display: block;
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 6px;
          color: #374151;
        }

        textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 0.95rem;
          font-family: inherit;
          resize: vertical;
          transition: border-color 0.15s;
        }

        textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,.12);
        }

        .file-input-wrapper {
          margin-top: 24px;
        }

        .file-drop {
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 28px 16px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }

        .file-drop:hover {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .file-drop p {
          color: #6b7280;
          font-size: 0.9rem;
        }

        .file-drop .browse {
          color: #2563eb;
          font-weight: 600;
          text-decoration: underline;
        }

        .file-name {
          margin-top: 10px;
          font-size: 0.85rem;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .file-name .icon { font-size: 1.1rem; }

        .btn {
          display: block;
          width: 100%;
          padding: 14px;
          margin-top: 28px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .btn-primary {
          background: #2563eb;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) { background: #1d4ed8; }

        .btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btn-warning {
          background: #ca8a04;
          color: #fff;
          margin-top: 12px;
        }

        .btn-warning:hover { background: #a16207; }

        .spinner-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 28px;
        }

        .spinner {
          width: 36px;
          height: 36px;
          border: 4px solid #e5e7eb;
          border-top-color: #2563eb;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .spinner-text {
          font-size: 0.9rem;
          color: #6b7280;
        }

        .result-section {
          margin-top: 28px;
        }

        .banner {
          padding: 16px 20px;
          border-radius: 8px;
          border-left: 5px solid;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .score-row {
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .progress-bar-bg {
          width: 100%;
          height: 10px;
          background: #e5e7eb;
          border-radius: 999px;
          margin-top: 8px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.4s ease;
        }

        .final-state {
          margin-top: 16px;
          text-align: center;
          font-weight: 700;
          font-size: 1.05rem;
          padding: 12px;
          border-radius: 8px;
        }

        .extracted-text {
          margin-top: 20px;
        }

        .extracted-text summary {
          cursor: pointer;
          font-size: 0.85rem;
          color: #6b7280;
          font-weight: 600;
        }

        .extracted-text pre {
          margin-top: 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          font-size: 0.8rem;
          max-height: 200px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .error-box {
          margin-top: 28px;
          padding: 14px 18px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.9rem;
        }
      `}</style>

      <div className="container">
        <div className="card">
          <h1>File Upload Validator</h1>
          <p className="subtitle">
            Validate that your description matches the uploaded file
          </p>

          <label htmlFor="description">Describe what you are uploading</label>
          <textarea
            id="description"
            placeholder="e.g. A signed rental agreement for 123 Main St..."
            value={description}
            onChange={handleDescriptionChange}
          />

          <div className="file-input-wrapper">
            <label>Upload file</label>
            <div
              className="file-drop"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) =>
                e.key === "Enter" && fileRef.current?.click()
              }
              role="button"
              tabIndex={0}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <p>
                <span className="browse">Browse files</span> or click here
              </p>
              <p style={{ fontSize: "0.8rem", marginTop: 4 }}>
                PDF, JPG, PNG, or MP4
              </p>
            </div>
            {file && (
              <div className="file-name">
                <span className="icon">&#128206;</span>
                {file.name}
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            disabled={loading || !file || !description.trim()}
            onClick={handleValidate}
          >
            {loading ? "Validating..." : "Validate & Upload"}
          </button>

          {loading && (
            <div className="spinner-wrapper">
              <div className="spinner" />
              <span className="spinner-text">
                Analyzing your file — this may take a moment...
              </span>
            </div>
          )}

          {error && <div className="error-box">{error}</div>}

          {result && !loading && (
            <div className="result-section">
              <div
                className="banner"
                style={{
                  background: bannerBg,
                  borderLeftColor: bannerColor,
                  color: bannerColor,
                }}
              >
                {result.message}
              </div>

              <div className="score-row">
                <span>Match Score</span>
                <span>{scorePercent}%</span>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${scorePercent}%`,
                    background: bannerColor,
                  }}
                />
              </div>

              {result.status === "allowed" && (
                <div
                  className="final-state"
                  style={{ background: "#f0fdf4", color: "#16a34a" }}
                >
                  Upload Confirmed
                </div>
              )}

              {result.status === "warning" && !submitted && (
                <button className="btn btn-warning" onClick={handleSubmitAnyway}>
                  Submit Anyway
                </button>
              )}

              {result.status === "warning" && submitted && (
                <div
                  className="final-state"
                  style={{ background: "#fefce8", color: "#a16207" }}
                >
                  Upload Submitted
                </div>
              )}

              {result.status === "blocked" && (
                <div
                  className="final-state"
                  style={{ background: "#fef2f2", color: "#dc2626" }}
                >
                  Upload Rejected
                </div>
              )}

              {result.extracted_text && (
                <details className="extracted-text">
                  <summary>View extracted text</summary>
                  <pre>{result.extracted_text}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
