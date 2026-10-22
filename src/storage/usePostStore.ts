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
    // 하위 페이지는 지우지 않고, 지운 글의 상위 페이지 밑으로 한 단계 올린다.
    deletePost: (id: string) => set((state) => {
        const parentId = state.posts.find((post) => post.id === id)?.parentId
        return {
            posts: state.posts
                .filter((post) => post.id !== id)
                .map((post) => (post.parentId === id ? { ...post, parentId } : post)),
        }
    }),
    reset: () => set({ posts: [] })
}));



