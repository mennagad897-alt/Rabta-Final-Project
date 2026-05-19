import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ==========================================
// Interfaces
// ==========================================
interface PostAuthor {
  _id: string;
  fullName: string;
  avatar: string;
  role?: string;
}

interface Comment {
  _id: string;
  author: PostAuthor;
  content: string;
  createdAt: string;
  likesCount: number;
  isAuthor?: boolean;
}

interface Post {
  _id: string;
  author: PostAuthor;
  content: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  likedByText: string;
  createdAt: string;
}

// ==========================================
// Component
// ==========================================
export const PostDetails: React.FC = () => {
  const navigate = useNavigate();
  const { postId } = useParams();

  // States — جاهزة للربط بالباك-إند
  const [post] = useState<Post | null>(null);
  const [comments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  // TODO (Backend): جلب بيانات البوست والتعليقات
  // useEffect(() => {
  //   axios.get(`/api/posts/${postId}`).then(res => setPost(res.data));
  //   axios.get(`/api/posts/${postId}/comments`).then(res => setComments(res.data));
  // }, [postId]);

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    // TODO (Backend): إرسال التعليق
    // axios.post(`/api/posts/${postId}/comments`, { content: commentText });
    setCommentText('');
  };


  // حالة التحميل أو عدم وجود البوست
  if (!post) {
    return (
      <main className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#FAFAFA] dark:bg-[#171717]">
        <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[#7C3AED] dark:text-[#8B5CF6] hover:opacity-80 font-medium transition-all duration-300 w-fit group"
          >
            <span className="material-icons-round text-xl transform group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Group
          </button>

          {/* Empty State */}
          <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 p-10 transition-all duration-500 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/20 rounded-full flex items-center justify-center mb-4">
              <span className="material-icons-round text-4xl text-[#7C3AED] dark:text-[#8B5CF6]">article</span>
            </div>
            <p className="text-lg font-bold text-gray-400 dark:text-gray-500 mb-2">Post not found</p>
            <p className="text-sm text-gray-300 dark:text-gray-600">This post may have been removed or is loading.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto relative custom-scrollbar bg-[#FAFAFA] dark:bg-[#171717]">
      <div className="max-w-3xl mx-auto px-6 py-12 flex flex-col gap-8">
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[#7C3AED] dark:text-[#8B5CF6] hover:opacity-80 font-medium transition-all duration-300 w-fit group"
        >
          <span className="material-icons-round text-xl transform group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Back to Group
        </button>

        {/* Post Article */}
        <article className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 p-8 sm:p-10 transition-all duration-500 relative overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7C3AED]/50 to-transparent dark:from-[#8B5CF6]/50"></div>

          {/* Author Info */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-5">
              <div className="p-1 bg-gradient-to-tr from-[#7C3AED]/20 to-transparent dark:from-[#8B5CF6]/20 rounded-full">
                <img src={post.author.avatar} alt={post.author.fullName} className="w-14 h-14 rounded-full object-cover border-4 border-white dark:border-[#262626]" />
              </div>
              <div>
                <h3 className="font-bold text-xl leading-tight hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] cursor-pointer transition-colors duration-300 text-[#171717] dark:text-[#F5F5F5]">{post.author.fullName}</h3>
                <p className="text-sm opacity-70 mt-1 font-medium tracking-wide">{post.author.role} • {post.createdAt}</p>
              </div>
            </div>
            <button className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors duration-300">
              <span className="material-icons-round text-xl opacity-60">more_vert</span>
            </button>
          </div>

          {/* Post Content */}
          <div className="mb-8">
            <p className="leading-loose text-lg font-light text-[#171717] dark:text-[#F5F5F5]">{post.content}</p>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-8">
              {post.tags.map((tag, i) => (
                <span key={i} className="bg-[#7C3AED]/5 text-[#7C3AED] dark:bg-[#8B5CF6]/10 dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/20 rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer hover:bg-[#7C3AED]/20 dark:hover:bg-[#8B5CF6]/30 transition-all duration-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="bg-[#FAFAFA] dark:bg-[#171717] rounded-xl py-4 px-6 flex items-center gap-6 text-sm font-medium opacity-90 mb-6">
            <span>{post.likedByText}</span>
            <span className="opacity-60">•</span>
            <span><strong>{post.commentsCount}</strong> Comments</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-black/5 dark:border-white/5">
            <button
              onClick={() => setIsLiked(!isLiked)}
              className={`flex-1 flex items-center justify-center gap-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-500 font-semibold tracking-wide text-sm group ${isLiked ? 'text-[#7C3AED] dark:text-[#8B5CF6]' : ''}`}
            >
              <span className={`material-icons-round text-xl ${isLiked ? '' : 'opacity-70 group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6]'} transition-colors`}>
                {isLiked ? 'thumb_up' : 'thumb_up_off_alt'}
              </span>
              Like
            </button>
            <button className="flex-1 flex items-center justify-center gap-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-500 font-semibold tracking-wide text-sm text-[#7C3AED] dark:text-[#8B5CF6]">
              <span className="material-icons-round text-xl">chat_bubble_outline</span>
              Comment
            </button>
            <button className="flex-1 flex items-center justify-center gap-3 py-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-500 font-semibold tracking-wide text-sm group">
              <span className="material-icons-round text-xl opacity-70 group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6] transition-colors">share</span>
              Share
            </button>
          </div>
        </article>

        {/* Comments Section */}
        <section className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-black/5 dark:border-white/5 p-8 sm:p-10 transition-all duration-500 relative overflow-hidden">
          <h4 className="text-2xl font-bold mb-8 tracking-tight text-[#171717] dark:text-[#F5F5F5]">Comments ({comments.length})</h4>

          {/* Comment Input */}
          <div className="flex gap-5 mb-10">
            <div className="w-12 h-12 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm border-2 border-white dark:border-[#262626]">
              U
            </div>
            <div className="flex-grow flex flex-col gap-4">
              <textarea
                rows={3}
                placeholder="Share your thoughts..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full bg-[#FAFAFA] dark:bg-[#171717] border-2 border-black/5 dark:border-white/5 rounded-xl px-6 py-4 focus:outline-none focus:border-[#7C3AED] dark:focus:border-[#8B5CF6] transition-all duration-500 placeholder-black/30 dark:placeholder-white/30 resize-none text-lg shadow-inner text-[#171717] dark:text-[#F5F5F5]"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitComment}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white px-8 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div className="flex flex-col gap-8">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="material-icons-round text-4xl text-gray-200 dark:text-gray-700 mb-3">chat_bubble_outline</span>
                <p className="text-sm text-gray-400 dark:text-gray-500">No comments yet. Be the first to share your thoughts!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment._id} className={`flex gap-5 group ${comment.isAuthor ? '' : ''}`}>
                  <img src={comment.author.avatar} alt={comment.author.fullName} className="w-12 h-12 rounded-full object-cover shrink-0 mt-1 shadow-sm border-2 border-white dark:border-[#262626]" />
                  <div className="flex-grow">
                    <div className={`bg-[#FAFAFA] dark:bg-[#171717] p-6 rounded-2xl rounded-tl-sm border border-black/5 dark:border-white/5 shadow-sm transition-all duration-300 group-hover:shadow-md ${comment.isAuthor ? 'border-l-4 border-l-[#7C3AED] dark:border-l-[#8B5CF6]' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-bold text-base text-[#171717] dark:text-[#F5F5F5] flex items-center gap-2">
                          {comment.author.fullName}
                          {comment.isAuthor && (
                            <span className="bg-[#7C3AED] text-white text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-bold shadow-sm">Author</span>
                          )}
                        </h5>
                        <span className="text-sm opacity-60 font-medium">{comment.createdAt}</span>
                      </div>
                      <p className="text-base leading-relaxed text-[#171717] dark:text-[#F5F5F5] font-light">{comment.content}</p>
                    </div>
                    <div className="flex gap-6 mt-3 px-4 text-xs font-bold opacity-70 tracking-wider">
                      <button className="hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-colors duration-300 flex items-center gap-1">
                        <span className="material-icons-round text-sm">favorite_border</span>
                        Like ({comment.likesCount})
                      </button>
                      <button className="hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition-colors duration-300">Reply</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
};
