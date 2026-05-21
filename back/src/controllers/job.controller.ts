import { Request, Response, NextFunction } from 'express';
import Job from '../models/Job';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import * as chatService from '../services/chat.service';

export const listJobs = catchAsync(async (req: Request, res: Response) => {
  const { search, types, experience, budget, sort, page = 1 } = req.query;
  const limit = 10;
  const skip = (Number(page) - 1) * limit;

  const filter: any = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { requiredSkills: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (types && typeof types === 'string' && types !== '') {
    const typeArray = types.split(',').map(t => t.toLowerCase().replace('-', '_'));
    filter.jobType = { $in: typeArray };
  }

  const sortOptions: any = {};
  if (sort === 'newest') sortOptions.createdAt = -1;
  else if (sort === 'oldest') sortOptions.createdAt = 1;

  const totalJobs = await Job.countDocuments(filter);
  const jobs = await Job.find(filter)
    .populate('publisherId', 'fullName avatar companyName location')
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);
  
  const jobsForFrontend = jobs
    .filter(job => job.publisherId != null)
    .map(job => {
    const jobObj = job.toObject();
    const publisher = (jobObj.publisherId as any) || {};
    const matchPercentage = Math.floor(Math.random() * 40) + 60;

    return {
      _id: jobObj._id,
      title: jobObj.title,
      companyName: publisher.companyName || 'Unknown Company',
      companyLogo: publisher.avatar || '/default-avatar.png',
      location: publisher.location || 'Remote',
      postedAt: jobObj.createdAt,
      description: jobObj.description,
      projectType: (jobObj.jobType || 'freelance').replace('_', '-').toUpperCase(),
      salaryOrBudget: jobObj.budgetOrSalary || 'Negotiable',
      experienceLevel: 'Intermediate', 
      tags: jobObj.requiredSkills || [],
      matchPercentage,
      publisherId: publisher._id,
      applicantsCount: jobObj.applicants?.length || 0
    };
  });

  res.status(200).json({
    status: 'success',
    results: jobsForFrontend.length,
    data: { 
      jobs: jobsForFrontend,
      totalPages: Math.ceil(totalJobs / limit),
      currentPage: Number(page)
    }
  });
});

export const getJobDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)?._id;
  const job = await Job.findById(req.params.id).populate('publisherId', 'fullName avatar companyName industry location');
  if (!job) return next(new AppError('Job not found', 404));

  const matchPercentage = Math.floor(Math.random() * 40) + 60;

  // Dynamically compute hasApplied so the frontend can disable the Apply button immediately
  const hasApplied = userId
    ? job.applicants?.some(a => a.userId.toString() === userId.toString()) ?? false
    : false;

  res.status(200).json({
    status: 'success',
    data: { job, matchPercentage, hasApplied }
  });
});

export const applyToJob = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { proposal, skills, note } = req.body;
  const currentUserId = (req.user as any)._id;
  const job = await Job.findById(req.params.id);
  
  if (!job) return next(new AppError('Job not found', 404));

  // ✅ DUPLICATE CHECK: Prevent applying more than once
  const alreadyApplied = job.applicants?.some(
    a => a.userId.toString() === currentUserId.toString()
  );
  if (alreadyApplied) {
    return next(new AppError('You have already applied for this job.', 400));
  }

  job.applicants?.push({
    userId: currentUserId,
    proposal: note || proposal || '',
    status: 'pending',
    appliedAt: new Date()
  });

  await job.save();

  // 1. Trigger "Access Chat" logic between Applicant and Job Owner
  const chat = await chatService.accessOrCreateChat(
    currentUserId.toString(),
    job.publisherId.toString()
  );

  if (!chat) {
    return next(new AppError('Failed to initialize chat with the employer.', 500));
  }

  // 2. Prepare Auto-Message and Attachments
  const messageText = `Hello, I am applying for ${job.title}. Please find my attached CV and notes.\n\nNotes: ${note || proposal || 'No additional notes provided.'}`;
  
  const attachments: { fileUrl: string; fileType: string; fileSize?: number }[] = [];
  if (req.file) {
    attachments.push({
      fileUrl: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size
    });
  }

  // 3. Send System-Generated Message
  const message = await chatService.createMessage({
    chatId: chat._id.toString(),
    senderId: currentUserId.toString(),
    content: messageText,
    messageType: req.file ? 'file' : 'text',
    attachments
  });

  // 4. Emit socket event
  const io = req.app.get('io');
  if (io) {
    io.to(chat._id.toString()).emit('receive-message', message);
  }

  res.status(200).json({
    status: 'success',
    message: 'Application submitted and sent to the employer via chat.',
    data: { message }
  });
});

export const createJob = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  // Also checking user.isVerifiedEmployer for legacy users without verificationStatus field
  if (user && user.role === 'employer' && user.verificationStatus !== 'approved' && !user.isVerifiedEmployer) {
    return next(new AppError('Your account is pending admin approval. You cannot post jobs yet.', 403));
  }

  const publisherId = (req.user as any)._id;
  const job = await Job.create({ ...req.body, publisherId });

  res.status(201).json({
    status: 'success',
    data: { job }
  });
});

export const getApplicants = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const job = await Job.findById(req.params.id).populate('applicants.userId', 'fullName avatar jobTitle skills');
  if (!job) return next(new AppError('Job not found', 404));

  if (job.publisherId.toString() !== (req.user as any)._id.toString()) {
    return next(new AppError('You are not authorized to view applicants for this job', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { applicants: job.applicants }
  });
});

export const updateJob = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const job = await Job.findById(req.params.id);
  if (!job) return next(new AppError('Job not found', 404));

  if (job.publisherId.toString() !== (req.user as any)._id.toString()) {
    return next(new AppError('You are not authorized to update this job', 403));
  }

  const updatedJob = await Job.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: { job: updatedJob }
  });
});

export const getAppliedJobs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as any)._id;

  // Find all jobs where the applicants array contains an object with userId matching the current user
  const jobs = await Job.find({ 'applicants.userId': userId })
    .populate('publisherId', 'companyName')
    .select('title publisherId applicants.status applicants.appliedAt applicants.userId');

  // Format the data for the frontend
  const formattedJobs = jobs.map(job => {
    // Find the specific application for this user
    const application = job.applicants?.find(app => app.userId.toString() === userId.toString());
    
    return {
      id: job._id,
      title: job.title,
      employer: (job.publisherId as any)?.companyName || 'Unknown Employer',
      appliedAt: application?.appliedAt,
      status: application?.status || 'pending'
    };
  });

  res.status(200).json({
    status: 'success',
    data: { applications: formattedJobs }
  });
});

export const deleteJob = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const job = await Job.findById(req.params.id);
  if (!job) return next(new AppError('Job not found', 404));

  if (job.publisherId.toString() !== (req.user as any)._id.toString()) {
    return next(new AppError('You are not authorized to delete this job', 403));
  }

  await Job.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});
