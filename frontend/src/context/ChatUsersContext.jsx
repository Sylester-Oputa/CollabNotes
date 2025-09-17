import React, { createContext, useContext } from 'react';

const ChatUsersContext = createContext([]);

export const ChatUsersProvider = ({ users, children }) => {
  return (
    <ChatUsersContext.Provider value={users || []}>
      {children}
    </ChatUsersContext.Provider>
  );
};

export const useChatUsers = () => useContext(ChatUsersContext);
