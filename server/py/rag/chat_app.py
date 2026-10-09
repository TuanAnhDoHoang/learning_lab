import os
import time
from google import genai
from google.genai import types


API_KEY = os.getenv("GEMINI_API_KEY", "")


def get_client():
    return genai.Client(api_key=API_KEY)


def create_store(client, display_name="knowledge-base"):
    store = client.file_search_stores.create(config={"display_name": display_name})
    print(f"[INFO] Store created: {store.name}")
    return store


def upload_document(client, store_name, file_path, display_name="document"):
    op = client.file_search_stores.upload_to_file_search_store(
        file=file_path,
        file_search_store_name=store_name,
        config={
            "display_name": display_name,
            "custom_metadata": [{"key": "category", "string_value": "toan-hoc"}],
        },
    )

    while not op.done:
        time.sleep(3)
        op = client.operations.get(op)

    print(f"[INFO] Document uploaded and indexed: {file_path}")
    return op


def build_chat(client, store_name):
    tool = types.Tool(
        file_search=types.FileSearch(
            file_search_store_names=[store_name],
            metadata_filter='category="toan-hoc"',
        )
    )

    chat = client.chats.create(
        model="gemini-3.6-flash",
        config=types.GenerateContentConfig(tools=[tool]),
    )
    return chat


def main():
    print("=== Gemini Chat App ===")
    print("Nhập 'exit' để thoát.")

    client = get_client()
    store_name = None

    doc_path = "kien_thuc_toan_hoc.md"
    if os.path.exists(doc_path):
        try:
            store = create_store(client)
            upload_document(client, store.name, doc_path, "Kien thuc toan hoc")
            store_name = store.name
        except Exception as exc:
            print(f"[WARN] Không thể tải tài liệu vào file search: {exc}")
            store_name = None
    else:
        print(f"[WARN] Không tìm thấy file {doc_path}. Chat sẽ hoạt động mà không có file search.")

    if store_name:
        chat = build_chat(client, store_name)
    else:
        chat = client.chats.create(model="gemini-3.8-flash")

    while True:
        try:
            user_input = input("\nBạn: ").strip()
        except KeyboardInterrupt:
            print("\nTạm biệt!")
            break

        if user_input.lower() in {"exit", "quit", "bye"}:
            print("Tạm biệt!")
            break

        if not user_input:
            continue

        try:
            response = chat.send_message(user_input)
            print(f"\nAI: {response.text}")

            grounding = getattr(response.candidates[0], "grounding_metadata", None)
            if grounding is not None:
                print("\n[Metadata]:")
                print(grounding)
        except Exception as exc:
            print(f"\n[LỖI] {exc}")


if __name__ == "__main__":
    main()
