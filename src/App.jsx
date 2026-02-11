import { useState, useMemo } from 'react';
import { Upload, Users, Instagram, FileJson, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import JSZip from 'jszip';
import './App.css';

// Generic recursive function to find all user-like objects in any JSON structure
function extractUsersRecursive(data) {
  let users = [];

  function traverse(obj) {
    if (!obj || typeof obj !== 'object') return;

    // Check for standard Instagram export format: { string_list_data: [{ value: 'username', ... }] }
    // OR format where username is in 'title' and not in string_list_data
    if (Array.isArray(obj.string_list_data)) {
      obj.string_list_data.forEach(subItem => {
        let username = subItem.value;

        // Fallback 1: Check if parent obj has 'title' which is often the username
        if (!username && obj.title && typeof obj.title === 'string') {
          username = obj.title;
        }

        // Fallback 2: Extract from href (e.g. https://www.instagram.com/_u/edgaranthoony)
        if (!username && subItem.href) {
          try {
            const urlObj = new URL(subItem.href);
            const parts = urlObj.pathname.split('/').filter(p => p && p !== '_u');
            if (parts.length > 0) {
              username = parts[parts.length - 1];
            }
          } catch (e) {
            // ignore invalid urls
          }
        }

        if (username) {
          users.push({
            username: username,
            href: subItem.href || `https://www.instagram.com/${username}`,
            timestamp: subItem.timestamp || 0
          });
        }
      });
      return;
    }

    // Fallback: Check if the object itself looks like a user entry 
    // More permissive: if it has 'value' and it looks like a username (no spaces, alphanumeric)
    // Instagram usernames are limited to 30 chars, allow a bit more for margin
    if (obj.value && typeof obj.value === 'string') {
      const val = obj.value;
      // Usernames: letters, numbers, periods, underscores. No spaces.
      // Exclude URLs just in case 'value' is used for something else
      const isUsername = /^[a-zA-Z0-9._]+$/.test(val) && !val.includes('http');

      if (isUsername) {
        users.push({
          username: val,
          href: obj.href || `https://www.instagram.com/${val}`,
          timestamp: obj.timestamp || 0
        });
        return;
      }
    }
    // Recurse
    if (Array.isArray(obj)) {
      obj.forEach(item => traverse(item));
    } else {
      Object.values(obj).forEach(val => traverse(val));
    }
  }

  traverse(data);

  // Deduplicate by username
  return Array.from(new Map(users.map(item => [item.username, item])).values());
}


function App() {
  const [fileLists, setFileLists] = useState(null); // { "filename": [users] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zipFileName, setZipFileName] = useState('');
  const [debugLog, setDebugLog] = useState([]);

  const addToLog = (msg) => {
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setZipFileName(file.name);
    setLoading(true);
    setError(null);
    setFileLists(null);
    setDebugLog([]);

    try {
      const zip = new JSZip();
      addToLog(`Loading zip file: ${file.name}`);
      const contents = await zip.loadAsync(file);

      const processedFiles = {};
      const filePromises = [];
      let totalFilesFound = 0;

      contents.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;

        const fullName = zipEntry.name.toLowerCase();
        // Skip hidden files or macos artifacts
        if (fullName.includes('__macosx') || fullName.includes('/.')) return;

        if (fullName.endsWith('.json')) {
          totalFilesFound++;
          filePromises.push(
            zipEntry.async('string').then(content => {
              try {
                const json = JSON.parse(content);
                const users = extractUsersRecursive(json);

                if (users.length > 0) {
                  // Use readable name: remove path, remove extension, replace underscores
                  const niceName = fullName.split('/').pop().replace('.json', '');
                  processedFiles[niceName] = users;
                  addToLog(`Parsed ${users.length} entries from ${niceName}`);
                } else {
                  addToLog(`Skipping ${fullName.split('/').pop()} (No user data found)`);
                  // Debugging: Show snippet of the structure
                  const snippet = JSON.stringify(json).slice(0, 150);
                  addToLog(`Snippet: ${snippet}...`);
                }
              } catch (e) {
                addToLog(`Error parsing ${fullName}: ${e.message}`);
              }
            }).catch(err => addToLog(`Error reading ${fullName}: ${err.message}`))
          );
        }
      });

      if (totalFilesFound === 0) {
        throw new Error("No JSON files found in the ZIP.");
      }

      await Promise.all(filePromises);

      const fileCount = Object.keys(processedFiles).length;
      addToLog(`Processing complete. Found relevant data in ${fileCount} files.`);

      if (fileCount === 0) {
        throw new Error('No user data could be extracted from any JSON file in the ZIP.');
      }

      // Sort keys to have consistent order (maybe prioritizing followers/following)
      const sortedKeys = Object.keys(processedFiles).sort((a, b) => {
        // specific priority
        const priority = ['followers', 'following'];
        const aP = priority.findIndex(p => a.includes(p));
        const bP = priority.findIndex(p => b.includes(p));

        if (aP !== -1 && bP !== -1) return aP - bP; // both in priority
        if (aP !== -1) return -1; // a is priority
        if (bP !== -1) return 1; // b is priority
        return a.localeCompare(b);
      });

      const sortedResult = {};
      sortedKeys.forEach(k => sortedResult[k] = processedFiles[k]);

      setFileLists(sortedResult);

    } catch (err) {
      console.error('Error processing zip:', err);
      setError(err.message);
      addToLog(`Fatal Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Instagram size={36} />
          <h1>InstaData Visualizer</h1>
        </div>
        <p className="subtitle">Visually explore your Instagram data exports.</p>
      </header>

      <main className="main-content">
        {!fileLists && (
          <div className={`upload-section single-upload ${loading ? 'loading' : ''}`}>
            <div className="upload-card full-width">
              <div className="icon-wrapper">
                {loading ? <Loader2 size={32} className="spin" /> : <FileJson size={32} />}
              </div>
              <h3>Upload Instagram Zip</h3>
              <p className="description">
                Upload your full 'instagram_data.zip'. We'll extract and visualize every list found (Followers, Following, Blocked, Close Friends, etc.)
              </p>

              {error && (
                <div className="error-message">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="file-status">
                {zipFileName && <span className="file-badge">{zipFileName}</span>}
              </div>

              <label className={`upload-btn ${loading ? 'disabled' : ''}`}>
                <Upload size={18} />
                <span>{loading ? 'Scanning...' : 'Select ZIP File'}</span>
                <input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={handleFileUpload}
                  disabled={loading}
                  hidden
                />
              </label>
            </div>
          </div>
        )}

        {fileLists && (
          <div className="results-container">
            <div className="stats-bar">
              {Object.keys(fileLists).map((name) => (
                <a href={`#${name}`} key={name} className="stat-pill">
                  {name.replace(/_/g, ' ')} <span className="count">({fileLists[name].length})</span>
                </a>
              ))}

              <button className="reset-btn" onClick={() => { setFileLists(null); setZipFileName(''); }}>
                Upload New
              </button>
            </div>

            <div className="file-lists-grid">
              {Object.entries(fileLists).map(([name, users]) => (
                <div className="result-card generic" id={name} key={name}>
                  <div className="card-header">
                    <div className="header-title">
                      <Users size={20} />
                      <h2 className="capitalize">{name.replace(/_/g, ' ')}</h2>
                    </div>
                    <span className="count-badge">{users.length}</span>
                  </div>
                  <div className="user-list">
                    {users.map((user, idx) => (
                      <a key={`${name}-${user.username}-${idx}`} href={user.href} target="_blank" rel="noopener noreferrer" className="user-item">
                        <div className="user-info">
                          <span className="username">@{user.username}</span>
                          {user.timestamp > 0 && (
                            <span className="timestamp">{new Date(user.timestamp * 1000).toLocaleDateString()}</span>
                          )}
                        </div>
                        <ExternalLink size={14} className="link-icon" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Processed locally in your browser.</p>
        {debugLog.length > 0 && (
          <div className="debug-log">
            <h4>Log:</h4>
            <div className="log-content">
              {debugLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;
