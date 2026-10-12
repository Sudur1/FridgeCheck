const Config = {
  Endpoint: "/api/analyze",
  StorageKey: "FridgeHelperUsualList"
};

const UsualInput = document.getElementById("UsualInput");
const SaveUsualBtn = document.getElementById("SaveUsualBtn");
const FridgeImage = document.getElementById("FridgeImage");
const Preview = document.getElementById("Preview");
const AnalyzeBtn = document.getElementById("AnalyzeBtn");
const Status = document.getElementById("Status");
const ResultList = document.getElementById("ResultList");

function SetStatus(message) {
  Status.textContent = message;
}

function LoadUsualList() {
  UsualInput.value = localStorage.getItem(Config.StorageKey) || "";
}

function SaveUsualList() {
  localStorage.setItem(Config.StorageKey, UsualInput.value);
  SetStatus("List saved!");
}

function ShowPreview() {
  const file = FridgeImage.files[0];
  if (!file) {
    Preview.hidden = true;
    return;
  }
  Preview.src = URL.createObjectURL(file);
  Preview.hidden = false;
}

function ReadFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function BuildPrompt(usualList) {
  return `You are a grocery assistant. The user's usual grocery list is:
${usualList}

Look at the fridge photo carefully.
1. List every food and drink item you can see, including items inside cartons, bottles, bags, and containers. If you see an egg carton with eggs in it, the item is "Eggs".
2. Compare to the usual list. An item is NOT missing if you can see it anywhere in the fridge, even inside a container or carton. Match names loosely (for example, an egg carton with eggs counts as "Eggs").
3. Only put an item in toBuy if you can clearly see it is absent or nearly empty. When unsure, do not add it to toBuy.

Return ONLY JSON in this exact shape, no other text:
{"scanned": ["item", "item"], "toBuy": ["item", "item"]}`;
}

function RenderSection(title, items, showCheckboxes) {
  const header = document.createElement("li");
  header.className = "SectionTitle";
  header.textContent = `${title} (${items.length})`;
  ResultList.appendChild(header);

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "Empty";
    empty.textContent = "None";
    ResultList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const text = document.createElement("span");
    text.textContent = item;
    label.appendChild(text);

    if (showCheckboxes) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => {
        text.classList.toggle("Done", checkbox.checked);
      });
      label.prepend(checkbox);
    }

    li.appendChild(label);
    ResultList.appendChild(li);
  });
}

function RenderResults(scanned, toBuy) {
  ResultList.innerHTML = "";
  RenderSection("Items in your fridge", scanned, false);
  RenderSection("To buy", toBuy, true);
  SetStatus(`Scanned ${scanned.length} item(s), ${toBuy.length} to buy.`);
}

async function AnalyzeFridge() {
  const file = FridgeImage.files[0];
  const usualList = UsualInput.value.trim();

  if (!file) return SetStatus("Pick a fridge photo first.");
  if (!usualList) return SetStatus("Save your usual list first.");

  SetStatus("Analyzing fridge...");
  AnalyzeBtn.disabled = true;

  try {
    const imageBase64 = await ReadFileAsBase64(file);

    const response = await fetch(Config.Endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: BuildPrompt(usualList),
        imageBase64: imageBase64,
        mimeType: file.type || "image/jpeg"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const Message = data.error?.message || data.error || `Status ${response.status}`;
      SetStatus(`Error: ${typeof Message === "string" ? Message : JSON.stringify(Message)}`);
      return;
    }

    if (!data.candidates || !data.candidates[0]) {
      SetStatus("No answer from AI. Check the console.");
      console.log(data);
      return;
    }

    const text = data.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(cleanText);

    RenderResults(result.scanned || [], result.toBuy || []);
  } catch (error) {
    console.error(error);
    SetStatus("Something went wrong. Check the console.");
  } finally {
    AnalyzeBtn.disabled = false;
  }
}

SaveUsualBtn.addEventListener("click", SaveUsualList);
FridgeImage.addEventListener("change", ShowPreview);
AnalyzeBtn.addEventListener("click", AnalyzeFridge);

LoadUsualList();