import React from 'react';
import PollContent from '../PollContent';

const PollRenderer = ({ message, currentUserId, allPollVotes, onVote, onViewVotes }) => {
    const votes = allPollVotes?.[message.id] || [];

    return (
        <PollContent
            msg={message}
            votes={votes}
            onVote={(idx) => onVote(message.id, idx, message.allow_multiple_answers)}
            currentUserId={currentUserId}
            onViewVotes={() => onViewVotes(message.id)}
        />
    );
};

export default PollRenderer;
