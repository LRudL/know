# know

> "Everything is a skill issue"

## General

See the .cursorrules file. This is auto-fed to Cursor if you have this project's root directory open. It tells the AI a bunch of valuable things about the project, and might be helpful for you too.

## Installation

### Backend Setup

In the backend folder (knowb), run:

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Fill in your Supabase credentials and API keys in .env
```

### Frontend Setup

```bash
npm install

# Fill in your Supabase credentials in .env.local after running the following command
cp .env.local.example .env.loca
```

## Running the project

In the frontend folder (knowf), run:

```bash
npm run dev
```

This will start the frontend server at http://localhost:3000. It will automatically scan for code changes in the knowf directory, and automatically reload if there is one.

In the backend folder (knowb), run:

```bash
uvicorn main:app --reload --reload-exclude="venv/*"
```

This will do the same for the backend (we exclude the Python virtual environment from reloading because sometimes that keeps changing for a few minutes after an install, causing restarts that can mess up whatever you're trying to test in the frontend).

Now, if you go to http://localhost:3000, you should see the homepage.

### Testing backend API endpoints in isolation

If you go to [http://localhost:8000/docs](http://localhost:8000/docs), you can play with the API endpoints. However, you'll need to get your JWT authentication token. Do this by going to the frontend at [http://localhost:3000/dashboard](http://localhost:3000/dashboard), then: open browser dev tools, go to Application --> Storage --> Local Storage, and copy the access token value:

<img width="488" alt="Screenshot 2024-12-05 at 20 57 34" src="https://github.com/user-attachments/assets/6fa52d6a-96f6-4efe-9a83-fb6dc543b531">

Then click on "Authorize" (green text button with padlock) in [http://localhost:8000/docs](http://localhost:8000/docs), and after this you should be able to try out the API endpoints. If you need to look up IDs of things, go to Supabase's Table Editor.

## Gotchas

- are there errors in the browser console?
- did the backend reloading crash because of an error? (see whatever terminal you have `uvicorn main:app --reload` running in)
- did the frontend reloading crash because of an error? (see whatever terminal you have `npm run dev` running in)

### Authentication errors - e.g. 403

Frontend<>backend authentication pattern:

1. Service Layer Pattern (like in graphService.ts):

```typescript
static async someApiCall() {
    // 1. Get session token
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("No auth session");

    // 2. Make authenticated request
    const response = await fetch("/api/your/endpoint", {
        method: "POST", // or GET, etc.
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data), // if needed
    });

    // 3. Handle response
    if (!response.ok) throw new Error("Request failed");
    return await response.json();
}
```

2. Backend Pattern (like in content_map.py):

```python
@router.post("/your-endpoint")
async def your_endpoint(data: YourModel, token: str = Depends(security)):
    # token is automatically validated by the security dependency
    # if invalid, FastAPI returns 403 Forbidden
    user_id = get_user_id_from_token(token)  # if you need the user ID
    # ... rest of your endpoint logic
```

Note that knowb/main.py has to mount the router too, for example:

```python
app.include_router(test.router, prefix="/api/test")
```

Key Points:

- Always get a fresh session token using supabase.auth.getSession()
- Include token in Authorization: Bearer ${token} header
- Use FastAPI's security dependency in backend endpoints
- Backend automatically returns 403 if token is invalid

### Vercel deployment failed?

Run `npx next lint` and fix linter errors. Vercel is strict about linting (why? because screw you, that's why).

Vercel hates dev dependencies, make sure you don't have any in package.json.

### Cursed bug that doesn't seem to be related to your code?

- Is it potentially a frontend<>backend connection issue?
  - knowf/middleware.ts defines the routing, it might be screwing stuff up
- Is it a potentially a Supabase database issue?
  - sanity-check tables in the database editor
  - check Supabase RLS policies (Database -> Policies -> see if there's delete/insert/update/select missing for some table you're accessing; ask Claude to write new policies if needed and run them in the Supabase SQL editor)
