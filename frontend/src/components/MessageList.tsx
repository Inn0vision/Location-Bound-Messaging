import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface MessageMeta {
  id: string;
  title: string;
  location: string;
  radius: number;
  created: number;
  expiresAt: number;
}

const MessageList = () => {
  const [messages, setMessages] = useState<MessageMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/messages');
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTimeLeft = (expiresAt: number) => {
    const now = Date.now();
    const left = expiresAt - now;
    if (left < 0) return 'EXPIRED';
    const hours = Math.floor(left / (1000 * 60 * 60));
    const mins = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-title">Stored Messages</span>
          <Link to="/compose" className="terminal-button-secondary px-2 py-1 text-xs">
            + NEW
          </Link>
        </div>

        <div className="terminal-body">
          {loading && (
            <div className="text-center py-12 text-terminal-accent animate-pulse">
              LOADING...
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center py-12 text-terminal-dim">
              <div className="mb-4">NO MESSAGES FOUND</div>
              <Link to="/compose" className="terminal-button">
                CREATE FIRST MESSAGE
              </Link>
            </div>
          )}

          {!loading && messages.length > 0 && (
            <div className="space-y-4">
              {messages.map((msg) => (
                <Link
                  key={msg.id}
                  to={`/messages/${msg.id}`}
                  className="block terminal-card hover:border-terminal-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-terminal-accent">{msg.title}</div>
                    <div className="terminal-badge-warning text-xs">
                      {getTimeLeft(msg.expiresAt)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-terminal-dim">Location:</div>
                      <div className="font-mono text-xs">{msg.location}</div>
                    </div>
                    <div>
                      <div className="text-terminal-dim">Radius:</div>
                      <div>{msg.radius}m</div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-terminal-dim">
                    Created: {formatDate(msg.created)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageList;
