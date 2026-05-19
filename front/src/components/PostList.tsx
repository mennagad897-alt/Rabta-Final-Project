import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchPosts } from '../store/slices/postsSlice';

/**
 * Post Card Component
 * مثال على component لعرض بطاقة بوست واحد
 */
interface Post {
  id: string;
  author: {
    name: string;
    avatar?: string;
    id?: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  createdAt: string;
}

const PostCard: React.FC<{ post: Post }> = ({ post }) => {
  return (
    <div className="bg-white dark:bg-[#262626] rounded-2xl p-6 border border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <img
          src={post.author.avatar || "https://i.pravatar.cc/150"}
          alt={post.author.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <h3 className="font-bold text-[#171717] dark:text-[#F5F5F5]">{post.author.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <p className="text-[#171717] dark:text-[#F5F5F5] mb-4">{post.content}</p>

      {post.image && (
        <img
          src={post.image}
          alt="Post image"
          className="w-full rounded-xl mb-4 object-cover max-h-96"
        />
      )}

      <div className="flex items-center gap-6 text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-lg">favorite</span>
          <span>{post.likes}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-icons-round text-lg">chat</span>
          <span>{post.comments}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * PostList Component - الـ MAIN COMPONENT
 */
export const PostList: React.FC = () => {
  const dispatch = useAppDispatch();

  // ✅ Get data من Redux store
  // استخدم useAppSelector بدل useSelector للحصول على type safety
  const posts = useAppSelector((state) => state.posts.items);
  const loading = useAppSelector((state) => state.posts.loading);
  const error = useAppSelector((state) => state.posts.error);
  const user = useAppSelector((state) => state.auth.user);

  /**
   * ✅ Dispatch fetchPosts عند تحميل الـ component
   * استخدم useEffect مع dependency array [dispatch]
   * عشان نحط اللـ dispatch مره واحده فقط عند التحميل الأول
   */
  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED] dark:border-[#8B5CF6]"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            جاري تحميل البوستات...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
            حدث خطأ
          </h3>
          <p className="text-red-600 dark:text-red-300 text-sm mb-4">
            {error}
          </p>
          <button
            onClick={() => dispatch(fetchPosts())}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            جرب مرة أخرى
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // EMPTY STATE
  // ============================================================================
  if (!loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-lg font-medium">ما في بوستات حالياً...</p>
          <p className="text-sm mt-2">كن أول من يشارك شيء جديد! 🚀</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SUCCESS STATE - عرض البوستات
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#171717] py-6">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#171717] dark:text-[#F5F5F5] mb-2">
            أهلاً {user?.name}! 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {posts.length} بوست
          </p>
        </div>

        {/* ✅ KEY PART: تعيين البوستات من Redux Store */}
        {/* استخدم .map() لـ render كل بوست */}
        <div className="space-y-4">
          {posts.map((post: Post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>

        {/* Load More Button (اختياري) */}
        {loading && posts.length > 0 && (
          <div className="flex justify-center mt-8">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              جاري تحميل المزيد...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostList;

/**
 * ============================================================================
 * استخدام هذا الـ Component
 * ============================================================================
 * 
 * في ملف routing أو App.tsx:
 * 
 * import PostList from './components/PostList';
 * 
 * <Route path="/feed" element={<PostList />} />
 * 
 * ============================================================================
 */
