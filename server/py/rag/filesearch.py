import time
from google import genai
from google.genai import types

GEMINI_API_KEY=""

client = genai.Client(api_key=GEMINI_API_KEY)

store = client.file_search_stores.create(
    config={"display_name": "knowledge-base"}
)
print(store.name)  # dạng: fileSearchStores/xxxx

op = client.file_search_stores.upload_to_file_search_store(
    file="kien_thuc_toan_hoc.md",
    file_search_store_name=store.name,
    config={
        "display_name": "Kien thuc toan hoc",
        "custom_metadata": [{"key": "category", "string_value": "toan-hoc"}],
    },
)

# Chờ lập chỉ mục xong
while not op.done:
    time.sleep(5)
    op = client.operations.get(op)


file_search_tool = types.Tool(
    file_search=types.FileSearch(
        file_search_store_names=[store.name],
        metadata_filter='category="toan-hoc"',
    )
)

chat = client.chats.create(
    model="gemini-3.8-flash",
    config=types.GenerateContentConfig(
        tools=[file_search_tool]
    ),
)

response = chat.send_message("Nêu bảy hằng đẳng thức đáng nhớ")

print(response.text)
print(response.candidates[0].grounding_metadata)  # trích dẫn nguồn

types.FileSearch(
    file_search_store_names=[store.name],
    metadata_filter='category="toan-hoc"',
)

# Liệt kê
for s in client.file_search_stores.list():
    print(s.name, s.display_name)

# Xoá (force=True để xoá cả file bên trong)
client.file_search_stores.delete(
    name=store.name, config={"force": True}
)