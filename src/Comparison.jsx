import { useMemo } from 'react';
import './Comparison.css';
import { UserMinus, UserPlus, Users, ArrowLeft, BarChart2 } from 'lucide-react';

function Comparison({ data, onBack }) {
    const { ghosts, fans, mutuals, hasData } = useMemo(() => {
        if (!data) return { ghosts: [], fans: [], mutuals: [], hasData: false };

        // Standardize keys to lowercase for searching
        const keys = Object.keys(data);
        const followerKey = keys.find(k => k.toLowerCase().includes('followers'));
        const followingKey = keys.find(k => k.toLowerCase().includes('following'));

        if (!followerKey || !followingKey) {
            return { ghosts: [], fans: [], mutuals: [], hasData: false };
        }

        const getSet = (key) => {
            const set = new Set();
            const map = new Map();
            data[key].forEach(u => {
                set.add(u.username);
                map.set(u.username, u);
            });
            return { set, map };
        };

        const followers = getSet(followerKey);
        const following = getSet(followingKey);

        const ghostsList = [];
        const fansList = [];
        const mutualsList = [];

        // Ghosts: Following but not in followers
        following.map.forEach((user, username) => {
            if (!followers.set.has(username)) {
                ghostsList.push(user);
            } else {
                mutualsList.push(user);
            }
        });

        // Fans: Followers but not in following
        followers.map.forEach((user, username) => {
            if (!following.set.has(username)) {
                fansList.push(user);
            }
        });

        return { ghosts: ghostsList, fans: fansList, mutuals: mutualsList, hasData: true };
    }, [data]);

    if (!hasData) {
        return (
            <div className="results-container">
                <button onClick={onBack} className="back-btn-large"><ArrowLeft size={20} /> Back to Data</button>
                <div className="empty-state">
                    <h3>Insufficient Data for Analysis</h3>
                    <p>We couldn't find "Followers" and "Following" lists in your uploaded data.</p>
                    <p>Please ensure your zip file contains these standard Instagram export files.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="results-container">
            <div className="comparison-header-bar">
                <button onClick={onBack} className="back-btn-large"><ArrowLeft size={20} /> Back</button>
                <h2><BarChart2 size={28} /> Relationship Analysis</h2>
            </div>

            <div className="stats-summary-grid">
                <div className="summary-card ghost">
                    <div className="icon-box"><UserMinus size={32} /></div>
                    <div className="summary-info">
                        <h3>Ghosts</h3>
                        <p className="big-number">{ghosts.length}</p>
                        <p className="caption">Following who don't follow back</p>
                    </div>
                </div>
                <div className="summary-card fans">
                    <div className="icon-box"><UserPlus size={32} /></div>
                    <div className="summary-info">
                        <h3>Fans</h3>
                        <p className="big-number">{fans.length}</p>
                        <p className="caption">Followers you don't follow back</p>
                    </div>
                </div>
                <div className="summary-card mutual">
                    <div className="icon-box"><Users size={32} /></div>
                    <div className="summary-info">
                        <h3>Mutuals</h3>
                        <p className="big-number">{mutuals.length}</p>
                        <p className="caption">You follow each other</p>
                    </div>
                </div>
            </div>

            <div className="file-lists-grid">
                <UserList title="Ghosts" users={ghosts} icon={<UserMinus size={20} />} type="ghost" />
                <UserList title="Fans" users={fans} icon={<UserPlus size={20} />} type="fans" />
                <UserList title="Mutuals" users={mutuals} icon={<Users size={20} />} type="mutual" />
            </div>
        </div>
    );
}

function UserList({ title, users, icon, type }) {
    return (
        <div className={`result-card ${type}`}>
            <div className="card-header">
                <div className="header-title">
                    {icon}
                    <h2>{title}</h2>
                </div>
                <span className="count-badge">{users.length}</span>
            </div>
            <div className="user-list">
                {users.map((u, idx) => (
                    <a key={`${type}-${u.username}-${idx}`} href={u.href} target="_blank" rel="noopener noreferrer" className="user-item">
                        <div className="user-info">
                            <span className="username">@{u.username}</span>
                            {u.timestamp > 0 && (
                                <span className="timestamp">{new Date(u.timestamp * 1000).toLocaleDateString()}</span>
                            )}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    )
}

export default Comparison;
