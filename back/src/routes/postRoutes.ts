import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getPostDetail,
  toggleLike,
  addComment,
  createPost,
  deletePost
} from '../controllers/post.controller';

import { uploadAvatar } from '../middlewares/upload.middleware';

const router = Router();

router.use(protect);

router.post('/', uploadAvatar.array('media', 5), createPost);
router.get('/:id', getPostDetail);
router.post('/:id/like', toggleLike);
router.post('/:id/comments', addComment);
router.delete('/:id', deletePost);

export default router;
