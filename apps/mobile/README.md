# JuChess Mobile

Flutter implementation of the JuChess mobile and tablet prototype.

## Run With Appwrite

```bash
flutter run \
  --dart-define=APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
  --dart-define=APPWRITE_PROJECT_ID=juchess-platform \
  --dart-define=APPWRITE_DATABASE_ID=juchess \
  --dart-define=APPWRITE_ACCESS_GUARD_FUNCTION_ID=access-guards
```

The access guard checks active email, University ID, phone, and IP blocks before
sign-in/sign-up and when restoring a saved session.
