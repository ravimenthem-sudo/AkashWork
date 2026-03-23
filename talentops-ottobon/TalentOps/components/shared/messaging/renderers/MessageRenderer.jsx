import React from 'react';
import TextRenderer from './TextRenderer';
import PollRenderer from './PollRenderer';

const renderers = {
    // We can key by message type if available, otherwise we use boolean flags
    poll: PollRenderer,
    text: TextRenderer
};

const MessageRenderer = (props) => {
    const { message } = props;

    // Determine renderer type
    let Renderer = renderers.text;

    if (message.is_poll) {
        Renderer = renderers.poll;
    }

    // If we define more types later (e.g., message.type === 'voice'), we add logic here
    // or better, ensure backend sends a 'type' field and map directly.

    return <Renderer {...props} />;
};

export default MessageRenderer;
