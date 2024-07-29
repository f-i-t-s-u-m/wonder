import { serve } from '@hono/node-server'
import { PrismaClient } from '@prisma/client'
import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { commentSchema, likeSchema, loginSchema, messageSchema, signupSchema } from '../schema'
import bcrypt from "bcryptjs"
import { jwt, sign, verify } from 'hono/jwt'


const secretKey = "topSecretssdeWEDsschjnY"

const app = new Hono()

const prisma = new PrismaClient()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/auth/login',  validator('json', (value, ctx) => {
    
  const validate = loginSchema.safeParse(value)
  if(!validate.success) {
    return ctx.json({message:"error", data:null, error:validate.error.issues}, 401)
  }
}), async(ctx) => {

  const data = await ctx.req.json()
  const checkUser = await prisma.user.findFirst({
    where:{
      email:data?.email
    }
  })

  if (!checkUser) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }

   
  const checkPassword = await bcrypt.compare(data.password, checkUser.password)

  if(!checkPassword) {
    return ctx.json({message:"Error", data:"email or password error"})
  }

  const payload = {
    sub:checkUser.id,
    role:"user",
    exp: Math.floor(Date.now() / 1000) * 3600
  }

 const token = await sign(payload, secretKey)

 return ctx.json({message:"success", data:{token}})

    
})
app.post('/auth/signup',  validator('json', (value, ctx) => {
    
  const validate = signupSchema.safeParse(value)
  if(!validate.success) {
    return ctx.json({message:"error", data:null, error:validate.error.issues}, 401)
  }
}), async(ctx) => {

  const data = await ctx.req.json()

  const salt = await bcrypt.genSalt(10)

  const hashPassword = await bcrypt.hash(data.password, salt)
 

  const createUser = await prisma.user.create({
    data:{
      name:data.name,
      email:data.email,
      password:hashPassword
    }
  })

  return ctx.json({message:"success", data:{...createUser, password:undefined}})
    
})

app.post('/message', validator('json', (value, ctx) => {
    
  const validate = messageSchema.safeParse(value)
  if(!validate.success) {
    return ctx.json({message:"error", data:null, error:validate.error.issues}, 401)
  }
}),  async(ctx) => {
  const data = await ctx.req.json()
  const req = await prisma.message.create({
    data:{
      user_id:data?.user_id,
      message:data?.message
    }
  })

  if(!req?.id) {
    return ctx.json({status:500, message:"error"}, 500)
  }

  return ctx.json({message:"success", data:req})
})

app.get('/message/:messageId', async(ctx) => {
  const messageId = ctx.req.param('messageId')

  const req = await prisma.message.findFirst({
    where:{
      id:messageId
    }
  })

  if(!req?.id) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }

  return ctx.json({message:"success", data:req})

})

app.post("/message/:messageId/comment", validator('json', (value, ctx) => {
    
  const validate = commentSchema.safeParse(value)
  if(!validate.success) {
    return ctx.json({message:"error", data:null, error:validate.error.issues}, 401)
  }
}), async(ctx) => {
  const messageId = ctx.req.param('messageId')
  const data = await ctx.req.json()

  try {

  const reqMsg = await prisma.message.findFirst({
    where:{
      id:messageId
    }
  })

  if(!reqMsg?.id) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }


  const req = await prisma.comment.create({
    data:{
      user_id:data.user_id,
      message_id:messageId,
      comment:data.comment
    }
  })

  if(!req?.id) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }

  return ctx.json({message:"success", data:req})


} catch {
  return ctx.json({status:500, message:"error", data:null}, 500)
}
})


app.get('/message/:messageId/comments', async(ctx) => {
  const messageId = ctx.req.param('messageId')

  const reqMsg = await prisma.message.findFirst({
    where:{
      id:messageId
    }
  })

  if(!reqMsg?.id) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }

  const req = await prisma.comment.findMany({
    where:{message_id:messageId}
  })



  return ctx.json({message:"success", data:req ?? []})

})


// add likes

app.post('/message/like',  validator('json', (value, ctx) => {
    
  const validate = likeSchema.safeParse(value)
  if(!validate.success) {
    return ctx.json({message:"error", data:null, error:validate.error.issues}, 401)
  }
}), async(ctx) => {

  const data = await ctx.req.json()


  const reqMsg = await prisma.message.findFirst({
    where:{
      id:data.message_id
    }
  })

  if(!reqMsg?.id) {
    return ctx.json({status:404, message:"error", data:null}, 404)
  }


  const checkFirst = await prisma.userLikes.findFirst({
    where:{
      user_id:data.user_id,
      message_id:data.message_id
    }
  })

  if(checkFirst?.id) {
    return ctx.json({status:200, message:"you already liked the message", data:null}, 200)
  }
  

   await prisma.message.update({
    where:{id:reqMsg.id},
    data:{
      like_amount:reqMsg.like_amount + 1
    }
  })

  await prisma.userLikes.create({
    data:{
      user_id:data?.user_id,
      message_id:data.message_id
    }
  })

  return ctx.json({message:"success", data:reqMsg.id}, 201)

})

app.delete("/comment/:commentId", async(ctx) => {

  const commentId = ctx.req.param('commentId')

  const authorization = ctx.req.header('authorization')

  if(!authorization) {
    return ctx.json({message:"error", data:"no auth found"})
  }

  try {
    
  const token : any = authorization?.split(" ")[1]
  let checkJWT : any

  try {

    checkJWT = await verify(token, secretKey)
  } catch {
    return ctx.json({message:"error", data:"authorization code error"})
  }


 if(!checkJWT) {
  return ctx.json({message:"error", data:"invalid token"})
 }


 const checkComment = await prisma.comment.findFirst({
  where:{
    id:commentId
  }
 })

 if(!checkComment?.id) {
  return ctx.json({status:404, message:"error", data:null}, 404)
}


if(checkComment.user_id != checkJWT.sub) {
  return ctx.json({message:"error", data:"unauthorized"}, 401)
}

await prisma.comment.delete({
  where:{
    id:commentId
  }
})

  return ctx.json({message:"success", data:{commentId}})

  
} catch{
  
  return ctx.json({message:"error"}, 500)
}

})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
