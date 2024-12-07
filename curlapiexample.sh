# gihub modle names:
# gpt-4o gpt-4o-mini  Meta-Llama-3.1-405B-Instruct Llama-3.2-90B-Vision-Instruct Mistral-large  Llama-3.2-11B-Vision-Instruct o1-preview o1-mini                 

#export OPENAI_SERVER="https://models.inference.ai.azure.com/chat/completions"

export OPENAI_SERVER="https://gmapi.suisuy.workers.dev/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"

export OPENAI_SERVER="https://gmapi.suisuy.workers.dev/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"


curl -X POST $OPENAI_SERVER \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -d '{
        "messages": [
            {
                "role": "system",
                "content": ""
            },
            {
                "role": "user",
                "content": "say ok to me just"
            }
        ],
        "model": "gpt-4o-mini",  
        "temperature": 0.7,
        "max_tokens": 8000,
        "top_p": 1
    }'

# max tokens 8000 in, 4000 out	, for o1 4000 in, 4000 out	
#you can change model and temprature,max_tokens

# this response 
# {"choices":[{"finish_reason":"stop","index":0,"message":{"content":"Ok!","role":"assistant"}}],"created":1733556142,"id":"chatcmpl-AbjQsdI4mAf2iMXJ2ctPZa6EVeC2d","model":"gpt-4o-mini","object":"chat.completion","system_fingerprint":"fp_04751d0b65","usage":{"completion_tokens":2,"prompt_tokens":16,"total_tokens":18}}



export OPENAI_SERVER="https://gmapi.suisuy.workers.dev/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"
curl -X POST $OPENAI_SERVER \
    -H "Content-Type: application/json" \
    -d '{
        "messages": [
            {
                "role": "system",
                "content": ""
            },
            {
                "role": "user",
                "content": "say ok to me just"
            }
        ],
        "model": "gpt-4o-mini",  
        "temperature": 0.7,
        "max_tokens": 8000,
        "top_p": 1
    }'
