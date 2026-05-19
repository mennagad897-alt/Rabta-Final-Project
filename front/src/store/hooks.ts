/* eslint-disable @typescript-eslint/no-explicit-any */
// التعديل: فصلنا الـ TypedUseSelectorHook عشان نكتب قبله كلمة type
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './store';

/**
 * قائمة Hook مخصصة للـ useDispatch بمعلومات TypeScript
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * قائمة Hook مخصصة للـ useSelector بمعلومات TypeScript
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;