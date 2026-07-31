import React from 'react';
import { NewChatModal } from './NewChatModal';
import { CallScreen } from './CallScreen';
import { AuthModal } from './AuthModal';
import { User, CallState } from '../types';

interface ModalsContainerProps {
  isNewChatModalOpen: boolean;
  users: User[];
  currentUser: User;
  onCloseNewChatModal: () => void;
  onCreateRoom: (memberIds: string[], roomName?: string, isGroup?: boolean) => void;
  callState: CallState | null;
  onEndCall: () => void;
  authModalState: { isOpen: boolean; mode: 'login' | 'register' | 'forgot' };
  onCloseAuthModal: () => void;
  onAuthSuccess: (user: User, account: { id: string; name: string; email: string }) => void;
}

export const ModalsContainer: React.FC<ModalsContainerProps> = ({
  isNewChatModalOpen,
  users,
  currentUser,
  onCloseNewChatModal,
  onCreateRoom,
  callState,
  onEndCall,
  authModalState,
  onCloseAuthModal,
  onAuthSuccess,
}) => {
  return (
    <>
      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <NewChatModal
          users={users}
          currentUser={currentUser}
          onClose={onCloseNewChatModal}
          onCreateRoom={onCreateRoom}
        />
      )}

      {/* Call Screen Overlay */}
      {callState && callState.isActive && (
        <CallScreen callState={callState} onEndCall={onEndCall} />
      )}

      {/* Auth Modal (Login / Register / Forgot Password) */}
      <AuthModal
        isOpen={authModalState.isOpen}
        initialMode={authModalState.mode}
        onClose={onCloseAuthModal}
        onSuccess={onAuthSuccess}
      />
    </>
  );
};
