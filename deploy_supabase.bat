@echo off
echo ==============================================================
echo SUPABASE EDGE FUNCTIONS DEPLOYMENT SCRIPT
echo ==============================================================

echo Make sure you are logged in to the Supabase CLI:
echo Run 'supabase login' if you haven't already.

echo.
echo Deploying analyze-call...
call npx supabase functions deploy analyze-call

echo.
echo Deploying analyze-text...
call npx supabase functions deploy analyze-text

echo.
echo Deploying analyze-caller...
call npx supabase functions deploy analyze-caller

echo.
echo Deploying twilio-voice...
call npx supabase functions deploy twilio-voice

echo.
echo ==============================================================
echo Deployment complete!
echo Please go to your Supabase Dashboard and add the ML_INFERENCE_URL secret.
echo ==============================================================
pause
