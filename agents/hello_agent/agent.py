from google.adk.agents import Agent

# ADK 按固定名字 root_agent 来找入口,改名它就找不到。
root_agent = Agent(
    name="hello_agent",
    model="gemini-2.5-flash",
    description="最小骨架:咖啡收敛教练的空壳,目前只会打招呼。",
    instruction="你是一个友好的助手。现在先简单跟用户打个招呼,确认你已经跑起来了。",
)
