import type { Post } from "../types";
import { seedIfEmpty } from "../lib/storage";
import { create } from "zustand";

type PostListUpdater = (list: Post[]) => Post[];

type PostStore = {
    posts: Post[];
    setPosts: (posts: Post[] | PostListUpdater) => void;
    updatePost: (next: Post) => void;
    deletePost: (id: string) => void;
}

export const usePostStore = create<PostStore>((set) => ({
    posts: seedIfEmpty(),
    setPosts: (next) =>
        set((state) => ({
            posts: typeof next === "function" ? next(state.posts) : next,
        })),
    updatePost: (next: Post) => set((state) => ({
        posts: state.posts.map((post) => (post.id === next.id ? next : post))
    })),
    deletePost: (id: string) => set((state) => ({
        posts: state.posts.filter((post) => post.id !== id)
    })),
    reset: () => set({ posts: [] })
}));



