import { Navigate, useParams } from 'react-router-dom';

/** Old `/shared/:id` URLs open the chat feed with the shared-media side panel instead of a static page. */
export function SharedChatRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to="/chats" replace state={id ? { openSharedForChat: id } : undefined} />;
}
