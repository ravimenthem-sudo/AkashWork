import React from 'react';
import { BarChart2, CheckCircle2 } from 'lucide-react';
import UserAvatar from '../UserAvatar';

const PollContent = ({ msg, votes, onVote, currentUserId, onViewVotes }) => {
    const totalVotes = votes.length;
    const optionVotes = msg.poll_options.map((option, idx) => {
        const votesForOption = votes.filter(v => v.option_index === idx);
        return {
            text: option,
            count: votesForOption.length,
            percentage: totalVotes > 0 ? (votesForOption.length / totalVotes) * 100 : 0,
            voters: votesForOption.map(v => ({
                id: v.user_id,
                name: v.profiles?.full_name || v.profiles?.email || 'Unknown',
                avatar: v.profiles?.avatar_url
            })),
            isVoted: votesForOption.some(v => v.user_id === currentUserId)
        };
    });

    return (
        <div className="poll-container">
            <div className="poll-question">{msg.poll_question}</div>
            <div className="poll-info">
                <BarChart2 size={14} />
                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} • {msg.allow_multiple_answers ? 'Multiple answers' : 'Select one'}
            </div>
            <div className="poll-options-list">
                {optionVotes.map((opt, idx) => (
                    <div key={idx} className="poll-option-item" onClick={() => onVote(idx)}>
                        <div className="poll-option-header">
                            <div className="poll-option-text">
                                {opt.isVoted ? <CheckCircle2 size={16} color="#3b82f6" /> : <div style={{ width: 16, height: 16, border: '1px solid #94a3b8', borderRadius: '50%' }} />}
                                {opt.text}
                            </div>
                            <div className="poll-option-stats">
                                <div className="voter-avatars">
                                    {opt.voters.slice(0, 3).map((voter, i) => (
                                        <div key={i} className="voter-avatar-mini" title={voter.name}>
                                            <UserAvatar
                                                user={{
                                                    full_name: voter.name,
                                                    avatar_url: voter.avatar
                                                }}
                                                size={20}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="vote-count-badge">{opt.count}</div>
                            </div>
                        </div>
                        <div className="poll-progress-container">
                            <div className="poll-progress-fill" style={{ width: `${opt.percentage}%` }} />
                        </div>
                    </div>
                ))}
            </div>
            <button className="poll-view-votes-btn" onClick={onViewVotes}>
                View votes
            </button>
        </div>
    );
};

export default PollContent;
