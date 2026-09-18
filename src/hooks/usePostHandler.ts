import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate, useRoute } from "../lib/router";
import { createEmptyPost, savePosts } from "../lib/storage";
import { usePostStore } from "../storage/usePostStore";
import type { Post, SaveState } from "../types";

export default function usePostHandler() {
    const route = useRoute();
    const { posts, setPosts, updatePost, deletePost } = usePostStore();

    const createPost = useCallback((): void => {
        const post: Post = createEmptyPost();
        setPosts((list: Post[]): Post[] => [post, ...list]);
        navigate({ name: 'editor', id: post.id });
    }, []);

    const activePost = useMemo(
        () => (route.name === 'editor' ? posts.find((post) => post.id === route.id) ?? null : null),
        [posts, route],
    )

    const firstRender = useRef(true)
    const [saveState, setSaveState] = useState<SaveState>('idle');
    // localStorage 동기화
    useEffect(() => {
        savePosts(posts)
        if (firstRender.current) {
            firstRender.current = false
            return
        }
        setSaveState('saving')
        const timer = window.setTimeout(() => setSaveState('saved'), 350)
        return () => window.clearTimeout(timer)
    }, [posts])

    return {
        saveState, posts, createPost, updatePost, deletePost, activePost
    };

}
