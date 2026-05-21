/**
 * ============================================================================
 * EXAMPLE FEED COMPONENT - How to Use Redux for Posts
 * ============================================================================
 * 
 * هذا المثال يوضح كيفية استخدام Redux hooks و selectors في component.
 * نسخ هذا الكود كمرجع عند بناء صفحات الـ Feed الفعلية.
 */

import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setPosts, setLoading } from '../store/slices/postsSlice';

/**
 * مثال على Post Component
 * (قد تحتاج لتعديله حسب تصميمك)
 */
const PostCard: React.FC<{ post: any }> = ({ post }) => {
  return (
    <div className="bg-white dark:bg-[#262626] rounded-lg p-4 mb-4 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-3">
        <img
          src={post.author?.avatar || 'https://via.placeholder.com/40'}
          alt={post.author?.name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div>
          <h3 className="font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {post.author?.name}
          </h3>
          <p className="text-xs text-gray-500">
            {new Date(post.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <p className="text-[#171717] dark:text-[#F5F5F5] mb-3">{post.content}</p>
      {post.image && (
        <img
          src={post.image}
          alt="post"
          className="w-full rounded-lg mb-3 object-cover max-h-96"
        />
      )}
      <div className="flex gap-4 text-gray-500 text-sm">
        <button className="hover:text-[#7C3AED]">👍 {post.likes}</button>
        <button className="hover:text-[#7C3AED]">💬 {post.comments}</button>
        <button className="hover:text-[#7C3AED]">↗️ Share</button>
      </div>
    </div>
  );
};

/**
 * FEED COMPONENT - استخدام Redux
 */
export const Feed: React.FC = () => {
  const dispatch = useAppDispatch();

  // ✅ الطريقة الصحيحة: استخدام useAppSelector للـ type-safe selectors
  const posts = useAppSelector((state) => state.posts.items);
  const loading = useAppSelector((state) => state.posts.loading);
  const error = useAppSelector((state) => state.posts.error);
  const authUser = useAppSelector((state) => state.auth.user);
  const authToken = useAppSelector((state) => state.auth.token);

  // Fetch posts عند تحميل الـ component
  useEffect(() => {
    const fetchPosts = async () => {
      dispatch(setLoading(true));
      try {
        // dummyمثال: استبدل هذا بـ API call الفعلي
        // const response = await fetch('/api/posts', {
        //   headers: { Authorization: `Bearer ${authToken}` }
        // });
        // const data = await response.json();
        // dispatch(setPosts(data));

        // مثال على dummy data للـ development:
        const dummyPosts = [
          {
            id: '1',
            author: { name: 'حمد', avatar: 'https://ui-avatars.com/api/?name=Hamad' },
            content: 'يلا يا جماعة! البرمجة صعبة بس المتعة في الـ debugging! 😅',
            image: null,
            likes: 42,
            comments: 5,
            createdAt: new Date(),
          },
          {
            id: '2',
            author: { name: 'فاطمة', avatar: 'https://ui-avatars.com/api/?name=Fatima' },
            content: 'انتهيت من تطوير الـ Redux! دا الشيء اللي كنت أدور عليه 🎉',
            image: null,
            likes: 128,
            comments: 23,
            createdAt: new Date(),
          },
        ];
        dispatch(setPosts(dummyPosts));
      } catch (err: any) {
        // dispatch(setError(err.message));
      }
    };

    fetchPosts();
  }, [dispatch, authToken]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED] mx-auto mb-4"></div>
          <p className="text-gray-500">جاري تحميل البوستات...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold">حدث خطأ</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-gray-500">
          <p>ما في بوستات حالياً... كن أول من يشارك! 🚀</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6 text-[#171717] dark:text-[#F5F5F5]">
        مرحباً {authUser?.name} 👋
      </h1>

      {/* ✅ الـ KEY PART: تعيين البوستات من Redux */}
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
};

export default Feed;

/**
 * ============================================================================
 * ملخص الخطوات عند استخدام Redux في أي component:
 * ============================================================================
 * 
 * 1. Import الـ hooks والـ actions:
 *    import { useAppDispatch, useAppSelector } from '../store/hooks';
 *    import { setPosts, setLoading } from '../store/slices/postsSlice';
 * 
 * 2. الحصول على الـ dispatch و selectors في الـ component:
 *    const dispatch = useAppDispatch();
 *    const posts = useAppSelector((state) => state.posts.items);
 * 
 * 3. Fetch البيانات في useEffect:
 *    useEffect(() => {
 *      const fetchData = async () => {
 *        dispatch(setLoading(true));
 *        try {
 *          const response = await fetch('/api/posts');
 *          const data = await response.json();
 *          dispatch(setPosts(data));
 *        } catch (error) {
 *          dispatch(setError(error.message));
 *        }
 *      };
 *      fetchData();
 *    }, [dispatch]);
 * 
 * 4. Render البيانات using .map():
 *    {posts.map((post) => (
 *      <PostCard key={post.id} post={post} />
 *    ))}
 * 
 * ============================================================================
 */
