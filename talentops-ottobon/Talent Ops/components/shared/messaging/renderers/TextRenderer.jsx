import React from 'react';

const TextRenderer = ({ message }) => {
    const content = message.content;
    if (!content) return null;

    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const lines = content.split('\n');

    return (
        <span className="text-message-content">
            {lines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                    {line.split(urlPattern).map((part, i) => {
                        if (part.match(urlPattern)) {
                            return (
                                <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                                    className="message-link"
                                    style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: '500', wordBreak: 'break-all' }}>
                                    {part}
                                </a>
                            );
                        }
                        return part;
                    })}
                    {lineIndex < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </span>
    );
};

export default TextRenderer;
