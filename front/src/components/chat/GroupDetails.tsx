import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import axiosInstance from "../../api/axiosInstance";

interface JoinRequestItem {
  _id?: string;
  userId: string | { _id?: string; fullName?: string; avatar?: string };
  status?: string;
}

interface ContactOption {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

/** Global member search runs only on Enter; require phone-like length to limit load */
const MIN_GLOBAL_SEARCH_LENGTH = 10;

interface GroupDetailsProps {
  chatId: string;
  chatName: string;
  description?: string;
  isPrivateGroup: boolean;
  groupMembers: any[];
  groupAdmins: string[];
  canAddMembers: boolean;
  isGroupAdmin?: boolean;
  joinRequests?: JoinRequestItem[];
  communityId?: string;
  onRespondToJoinRequest?: (
    userId: string,
    action: "accept" | "reject",
  ) => void | Promise<void>;
  onMembersUpdated?: (members: any[]) => void;
  onDeleteGroup?: () => void | Promise<void>;
  isInvitedView?: boolean;
  onAcceptInvitation?: () => void | Promise<void>;
  onDeclineInvitation?: () => void | Promise<void>;
  /** Legacy hook for ChatWindow; GroupsFeed uses built-in modal when communityId is set */
  onAddMember?: () => void;
  onClose: () => void;
  onLeaveGroup: () => void;
  onSearchClick: () => void;
  onEditGroup: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const GroupDetails: React.FC<GroupDetailsProps> = ({
  chatId,
  chatName,
  description,
  isPrivateGroup,
  groupMembers,
  groupAdmins,
  canAddMembers,
  isGroupAdmin = false,
  joinRequests = [],
  communityId,
  onRespondToJoinRequest,
  onMembersUpdated,
  onDeleteGroup,
  isInvitedView = false,
  onAcceptInvitation,
  onDeclineInvitation,
  onAddMember,
  onClose,
  onLeaveGroup,
  onSearchClick,
  onEditGroup,
  isMuted,
  onToggleMute,
}) => {
  const [activeTab, setActiveTab] = useState<"Members" | "Media" | "Posts">(
    "Members",
  );
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [recentContacts, setRecentContacts] = useState<ContactOption[]>([]);
  /** null = show recent-contacts list; array = last global search result (may be empty) */
  const [globalSearchResults, setGlobalSearchResults] = useState<
    ContactOption[] | null
  >(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const memberIds = useMemo(
    () =>
      new Set(
        (groupMembers ?? []).map((m) =>
          String(typeof m === "string" ? m : m._id || ""),
        ),
      ),
    [groupMembers],
  );

  useEffect(() => {
    if (!showAddMembersModal) {
      setAddMemberQuery("");
      setGlobalSearchResults(null);
      return;
    }

    const fetchRecent = async () => {
      setLoadingContacts(true);
      try {
        const { data } = await axiosInstance.get("/users/recent-contacts");
        const contacts: ContactOption[] = (data.data?.contacts ?? [])
          .map(
            (u: {
              _id: string;
              fullName?: string;
              avatar?: string;
              jobTitle?: string;
              role?: string;
            }) => ({
              id: String(u._id),
              name: u.fullName || "User",
              avatar: u.avatar,
              role: u.jobTitle || u.role,
            }),
          )
          .filter((c: ContactOption) => !memberIds.has(String(c.id)));
        setRecentContacts(contacts);
      } catch {
        toast.error("Failed to load recent contacts");
        setRecentContacts([]);
      } finally {
        setLoadingContacts(false);
      }
    };

    void fetchRecent();
  }, [showAddMembersModal, memberIds]);

  const handleAddMemberQueryChange = (value: string) => {
    setAddMemberQuery(value);
    setGlobalSearchResults(null);
  };

  const runGlobalMemberSearch = async () => {
    const q = addMemberQuery.trim();
    if (!q) {
      setGlobalSearchResults(null);
      return;
    }
    if (q.length < MIN_GLOBAL_SEARCH_LENGTH) {
      toast.error(
        `Enter at least ${MIN_GLOBAL_SEARCH_LENGTH} characters (e.g. a full phone number), then press Enter`,
      );
      return;
    }

    setSearchingUsers(true);
    try {
      const { data } = await axiosInstance.get("/users/search/all", {
        params: { keyword: q, limit: 20 },
      });
      const raw = data.data?.users ?? data.data ?? [];
      const list = Array.isArray(raw) ? raw : [];
      const users: ContactOption[] = list
        .map(
          (u: {
            _id: string;
            fullName?: string;
            avatar?: string;
            jobTitle?: string;
            role?: string;
          }) => ({
            id: String(u._id),
            name: u.fullName || "User",
            avatar: u.avatar,
            role: u.jobTitle || u.role,
          }),
        )
        .filter((c: ContactOption) => !memberIds.has(String(c.id)));
      setGlobalSearchResults(users);
    } catch {
      toast.error("Search failed. Please try again.");
      setGlobalSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const displayContacts =
    globalSearchResults !== null ? globalSearchResults : recentContacts;

  const handleAddMember = async (userId: string) => {
    if (!communityId) return;
    setAddingUserId(userId);
    try {
      const { data } = await axiosInstance.post(
        `/groups/${communityId}/members`,
        {
          userId,
        },
      );
      const updatedMembers = data.data?.community?.members ?? groupMembers;
      onMembersUpdated?.(updatedMembers);
      setRecentContacts((prev) => prev.filter((c) => c.id !== userId));
      setGlobalSearchResults((prev) =>
        prev ? prev.filter((c) => c.id !== userId) : prev,
      );
      toast.success("Invitation sent");
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(message || "Failed to add member");
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRequestAction = async (
    userId: string,
    action: "accept" | "reject",
  ) => {
    if (!onRespondToJoinRequest) return;
    setProcessingUserId(userId);
    try {
      await onRespondToJoinRequest(userId, action);
    } finally {
      setProcessingUserId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-4 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 relative shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 text-gray-400 hover:text-red-500 transition-colors"
        >
          <span className="material-icons">close</span>
        </button>
        <h3 className="font-bold text-[#171717] dark:text-[#F5F5F5]">
          Group Info
        </h3>
        <button
          onClick={onEditGroup}
          className="text-[#7C3AED] hover:text-[#6D28D9] transition-colors mt-2"
        >
          <span className="material-icons-round text-xl">edit</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
        <div className="flex flex-col">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4">
              <div className="w-28 h-28 rounded-full bg-linear-to-tr from-[#7C3AED] to-[#ec4899] text-white flex items-center justify-center text-4xl font-bold shadow-lg">
                G
              </div>
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10B981] border-4 border-white dark:border-[#262626] rounded-full"></div>
            </div>
            <h3 className="font-bold text-xl text-[#171717] dark:text-[#F5F5F5] text-center mb-1">
              {chatName}
            </h3>
            <p className="text-sm text-gray-500 text-center">
              {groupMembers?.length || 0} members
            </p>
          </div>

          <div className="flex justify-between items-center w-full px-2 mb-8">
            {canAddMembers && (
              <div
                className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  if (onAddMember) onAddMember();
                  else if (communityId) setShowAddMembersModal(true);
                }}
              >
                <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-[#7C3AED]">
                  <span className="material-icons-round">person_add</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">Add</span>
              </div>
            )}

            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                onToggleMute();
                toast.success(
                  isMuted ? "Notifications unmuted" : "Notifications muted",
                );
              }}
            >
              <div
                className={`w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center ${isMuted ? "text-[#7C3AED]" : "text-gray-500 dark:text-gray-400"}`}
              >
                <span className="material-icons-round">
                  {isMuted ? "notifications_off" : "notifications"}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {isMuted ? "Unmute" : "Mute"}
              </span>
            </div>

            <div
              className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onSearchClick}
            >
              <div className="w-12 h-12 rounded-full bg-[#FAFAFA] dark:bg-[#171717] border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                <span className="material-icons-round">search</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">Search</span>
            </div>
          </div>

          <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-800">
            <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">
              About
            </h4>
            <p className="text-sm text-[#171717] dark:text-[#F5F5F5] leading-relaxed">
              {description?.trim() || "No description provided."}
            </p>
          </div>

          {isGroupAdmin && joinRequests.length > 0 && (
            <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-3">
                Join Requests
              </h4>
              <div className="flex flex-col gap-2">
                {joinRequests.map((request) => {
                  const userId =
                    typeof request.userId === "string"
                      ? request.userId
                      : request.userId?._id || "";
                  const displayName =
                    typeof request.userId === "object"
                      ? request.userId?.fullName || "User"
                      : "User";
                  const isProcessing = processingUserId === userId;
                  return (
                    <div
                      key={request._id || userId}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-[#262626] rounded-xl border border-gray-100 dark:border-gray-800"
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 overflow-hidden">
                        {typeof request.userId === "object" &&
                          request.userId?.avatar ? (
                          <img
                            src={request.userId.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          displayName.charAt(0)
                        )}
                      </div>
                      <span className="text-sm font-medium text-[#171717] dark:text-[#F5F5F5] flex-1 truncate">
                        {displayName}
                      </span>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          void handleRequestAction(userId, "accept")
                        }
                        className="px-2.5 py-1 text-xs font-bold text-white bg-[#10B981] hover:bg-[#059669] rounded-lg disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() =>
                          void handleRequestAction(userId, "reject")
                        }
                        className="px-2.5 py-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canAddMembers && (
            <div className="w-full bg-[#FAFAFA] dark:bg-[#171717] rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800">
              <h4 className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider mb-2">
                Invite Link
              </h4>
              <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#262626] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5">
                <span className="text-sm text-gray-500 truncate select-all">{`https://rabta.app/g/${chatId}`}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `https://rabta.app/g/${chatId}`,
                    );
                    toast.success("Link copied!");
                  }}
                  className="text-[#7C3AED] hover:text-[#6D28D9] shrink-0 transition-colors"
                >
                  <span className="material-icons-round text-lg">
                    content_copy
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#FAFAFA] dark:bg-[#171717] p-1 rounded-xl mb-4 border border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setActiveTab("Members")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === "Members" ? "bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm" : "text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]"}`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveTab("Media")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === "Media" ? "bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm" : "text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]"}`}
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab("Posts")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === "Posts" ? "bg-white dark:bg-[#262626] text-[#7C3AED] shadow-sm" : "text-gray-500 hover:text-[#171717] dark:hover:text-[#F5F5F5]"}`}
            >
              Posts
            </button>
          </div>

          <div className="w-full">
            {activeTab === "Members" && (
              <div className="flex flex-col gap-3">
                {groupMembers?.length ? (
                  groupMembers.map((member, i) => {
                    const memberId =
                      typeof member === "string" ? member : member._id;
                    const isMemberAdmin = memberId
                      ? (groupAdmins || []).some(
                        (id) => String(id) === String(memberId),
                      )
                      : false;
                    const displayName =
                      member.fullName ||
                      (typeof member === "string" ? member : "Unknown");
                    return (
                      <div
                        key={memberId || i}
                        className="flex items-center gap-3 p-2 hover:bg-[#FAFAFA] dark:hover:bg-[#171717] rounded-xl cursor-pointer transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 shrink-0 overflow-hidden">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            displayName.charAt(0)
                          )}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-bold text-[#171717] dark:text-[#F5F5F5] truncate">
                            {displayName}
                          </span>
                          <div className="flex items-center gap-2">
                            {isMemberAdmin ? (
                              <span className="text-[10px] bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                                Admin
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                Member
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-sm text-gray-500 py-4">
                    No members to display.
                  </div>
                )}
              </div>
            )}

            {activeTab === "Media" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
              </div>
            )}

            {activeTab === "Posts" && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <span className="material-icons-round text-4xl opacity-20 mb-2">
                  article
                </span>
                <p className="text-sm">No posts yet.</p>
              </div>
            )}
          </div>

          {isInvitedView ? (
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void onAcceptInvitation?.()}
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold transition-colors"
              >
                Accept Invitation
              </button>
              <button
                type="button"
                onClick={() => void onDeclineInvitation?.()}
                className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-bold"
              >
                Decline Invitation
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onLeaveGroup}
                className="mt-8 flex items-center justify-center gap-2 w-full py-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-bold"
              >
                <span className="material-icons-round">exit_to_app</span>
                Leave Group
              </button>

              {isGroupAdmin && onDeleteGroup && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Delete this group permanently? This cannot be undone.",
                      )
                    )
                      return;
                    setIsDeleting(true);
                    try {
                      await onDeleteGroup();
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-bold disabled:opacity-50"
                >
                  <span className="material-icons-round">delete_forever</span>
                  {isDeleting ? "Deleting..." : "Delete Group"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showAddMembersModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAddMembersModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#262626] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-5 z-10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-[#171717] dark:text-[#F5F5F5]">
                Add Members
              </h4>
              <button
                type="button"
                onClick={() => setShowAddMembersModal(false)}
                className="text-gray-400 hover:text-red-500"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <input
              type="text"
              value={addMemberQuery}
              onChange={(e) => handleAddMemberQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runGlobalMemberSearch();
                }
              }}
              placeholder={`Type ${MIN_GLOBAL_SEARCH_LENGTH}+ chars (e.g. phone), then Enter to search globally…`}
              className="w-full px-4 py-2.5 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#FAFAFA] dark:bg-[#171717] text-sm outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {loadingContacts || searchingUsers ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  {searchingUsers ? "Searching..." : "Loading recent contacts..."}
                </p>
              ) : displayContacts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  {globalSearchResults !== null
                    ? "No users found."
                    : "No recent contacts to invite."}
                </p>
              ) : (
                displayContacts.map((contact: ContactOption) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {contact.avatar ? (
                          <img
                            src={contact.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          contact.name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {contact.name}
                        </p>
                        {contact.role && (
                          <p className="text-xs text-gray-500 truncate">
                            {contact.role}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={addingUserId === contact.id}
                      onClick={() => void handleAddMember(contact.id)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg disabled:opacity-50 shrink-0"
                    >
                      {addingUserId === contact.id ? "..." : "Invite"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
