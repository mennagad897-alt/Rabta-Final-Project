import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware';
import {
  getPostDetail,
  toggleLike,
  addComment,
  createPost
} from '../controllers/post.controller';

import { uploadMedia } from '../middlewares/upload.middleware';

const router = Router();

router.use(protect);

router.post('/', uploadMedia.array('media', 5), createPost);
router.get('/:id', getPostDetail);
router.post('/:id/like', toggleLike);
router.post('/:id/comments', addComment);

export default router;
