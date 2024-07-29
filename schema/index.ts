import {z} from "zod"
export const messageSchema = z.object({
    user_id:z.string(),
    message:z.string().min(10).max(254)
})


export const commentSchema = z.object({
    user_id:z.string(),
    comment:z.string().min(10).max(254)
})


export const likeSchema = z.object({
    user_id:z.string(),
    message_id:z.string()
})

export const loginSchema = z.object({
    email:z.string().email(),
    password:z.string().min(8).max(100)
})

export const signupSchema = z.object({
    name:z.string().min(3).max(25),
    email:z.string().email(),
    password:z.string().min(8).max(100)
})