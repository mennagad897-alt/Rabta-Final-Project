import { Request, Response, NextFunction } from 'express';
import Post from '../models/Post';
import Message from '../models/Message';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';

export const getPostDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const post = await Post.findById(req.params.id)
    .populate('authorId', 'fullName avatar jobTitle')
    .populate('comments.userId', 'fullName avatar jobTitle')
    .populate('likes', 'fullName');
  
  if (!post) return next(new AppError('Post not found', 404));

  res.status(200).json({
    status: 'success',
    data: { post }
  });
});

export const toggleLike = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  const userId = (req.user as any)._id;
  const isLiked = post.likes?.includes(userId);

  if (isLiked) {
    post.likes = post.likes?.filter(id => id.toString() !== userId.toString());
  } else {
    post.likes?.push(userId);
  }

  await post.save();

  res.status(200).json({
    status: 'success',
    data: { post }
  });
});

export const addComment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { content } = req.body;
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  post.comments?.push({
    userId: (req.user as any)._id,
    commentText: content,
    createdAt: new Date()
  });

  await post.save();

  res.status(200).json({
    status: 'success',
    data: { post }
  });
});

export const createPost = catchAsync(async (req: Request, res: Response) => {
  const { content, communityId } = req.body;
  const authorId = (req.user as any)._id;

  // Handle uploaded files if any
  let media: any[] = [];
  if (req.files && Array.isArray(req.files)) {
    media = req.files.map((file: any) => ({
      fileUrl: file.path, 
      fileType: file.mimetype
    }));
  }

  const post = await Post.create({
    authorId,
    content,
    media,
    communityId: communityId || undefined
  });

  res.status(201).json({
    status: 'success',
    data: { post }
  });
});

export const deletePost = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const post = await Post.findById(req.params.id);
  if (!post) return next(new AppError('Post not found', 404));

  if (post.authorId?.toString() !== (req.user as any)._id.toString()) {
    return next(new AppError('You are not authorized to delete this post', 403));
  }

  await Post.findByIdAndDelete(req.params.id);
  await Message.deleteMany({ postId: req.params.id });

  res.status(204).json({
    status: 'success',
    data: null
  });
});
