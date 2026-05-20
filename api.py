from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

app = FastAPI()

# מאפשר לכל בקשה מה-Frontend להגיע לשרת
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserLogin(BaseModel):
    email: str
    password: str

@app.post("/api/login")
async def login(user: UserLogin):
    # כאן השרת מחזיר תשובה שמאשרת שהוא קיבל את הנתונים
    return {"status": "success", "user": {"email": user.email}}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
