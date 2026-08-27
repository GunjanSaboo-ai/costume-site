import pandas as pd
import json
import os
from collections import defaultdict
import glob

def scan_images_folder(images_path='images'):
    """
    Scan the images folder and return a list of available design numbers
    """
    image_files = []
    extensions = ['*.jpg', '*.jpeg', '*.png', '*.webp']
    
    for ext in extensions:
        image_files.extend(glob.glob(os.path.join(images_path, ext)))
    
    # Extract design numbers from filenames (remove extension)
    design_numbers = []
    for img in image_files:
        filename = os.path.basename(img)
        design_no = os.path.splitext(filename)[0]
        design_numbers.append(design_no)
    
    return design_numbers

def convert_excel_to_json(excel_file_path, images_folder='images', output_json_path='data/inventory.json'):
    """
    Convert Excel inventory file to JSON format with location/bin management
    """
    
    # Load Excel file
    df = pd.read_excel(excel_file_path)
    
    # Scan available images
    available_images = scan_images_folder(images_folder)
    print(f"📸 Found {len(available_images)} images: {available_images}")
    
    # Master data mappings
    master_data = {
        "garmentTypes": {
            "0003": "Frock",
            "0004": "Skirt",
            "0005": "Dress",
            "0006": "Top",
            "0007": "Bottom"
        },
        "colors": {
            "01": "Blue",
            "02": "Black",
            "03": "White",
            "04": "Red",
            "05": "Pink",
            "06": "Green",
            "07": "Yellow",
            "08": "Orange",
            "09": "Purple",
            "10": "Brown",
            "11": "Multicolor",
            "12": "Peach"
        },
        "genders": {
            "01": "Girls",
            "02": "Boys",
            "03": "Unisex"
        },
        "sizes": {
            "01": "18",
            "02": "20",
            "03": "22",
            "04": "24",
            "05": "26",
            "06": "28",
            "07": "30",
            "08": "32",
            "09": "34",
            "10": "36"
        }
    }
    
    # Group by design number
    designs = defaultdict(lambda: {
        "designNo": "",
        "productName": "",
        "colorCode": "",
        "color": "",
        "groupTypeCode": "",
        "groupType": "",
        "genderCode": "",
        "gender": "",
        "sizes": defaultdict(int),
        "items": [],
        "images": [],
        "totalPieces": 0
    })
    
    location_counter = 1
    
    for index, row in df.iterrows():
        design_no = str(row['DESIGN_NO']).strip()
        
        # Skip if no design number
        if pd.isna(design_no) or design_no == '':
            continue
        
        # Get values
        group_type_code = str(row['ITEM_GP_CODE']).strip() if not pd.isna(row['ITEM_GP_CODE']) else ""
        color_code = str(row['COLOR_CODE']).strip() if not pd.isna(row['COLOR_CODE']) else ""
        gender_code = str(row['GENDER_CODE']).strip() if not pd.isna(row['GENDER_CODE']) else ""
        size_code = str(row['SIZE_CODE']).strip() if not pd.isna(row['SIZE_CODE']) else ""
        sr_no = str(row['SR_NO']).strip() if not pd.isna(row['SR_NO']) else ""
        barcode = str(row['TAG_ID']).strip() if not pd.isna(row['TAG_ID']) else ""
        product_name = str(row['PRODUCT_NAME']).strip() if not pd.isna(row['PRODUCT_NAME']) else ""
        loc_code = str(row['LOC_CODE']).strip() if not pd.isna(row['LOC_CODE']) else ""
        
        # Generate location bin if not provided
        if not loc_code or loc_code == '':
            # Create a location bin based on design and item number
            aisle = chr(65 + (int(design_no) % 26))  # A, B, C, etc.
            rack = str((int(design_no) % 10) + 1).zfill(2)
            shelf = str(location_counter % 100).zfill(3)
            location_bin = f"{aisle}-{rack}-{shelf}"
            location_counter += 1
        else:
            # Use provided location code
            location_bin = loc_code
        
        # Get mapped values
        group_type = master_data["garmentTypes"].get(group_type_code, "Frock")
        color = master_data["colors"].get(color_code, f"Color{color_code}")
        gender = master_data["genders"].get(gender_code, "Girls")
        size = master_data["sizes"].get(size_code, size_code)
        
        # Set design info (only once)
        design = designs[design_no]
        if not design["designNo"]:
            design["designNo"] = design_no
            design["productName"] = product_name.split(' ')[0] + " " + color if product_name else f"Design {design_no}"
            design["colorCode"] = color_code
            design["color"] = color
            design["groupTypeCode"] = group_type_code
            design["groupType"] = group_type
            design["genderCode"] = gender_code
            design["gender"] = gender
            
            # Check if image exists for this design
            if design_no in available_images:
                design["images"].append(f"{design_no}.jpg")
            else:
                design["images"] = []
        
        # Add individual item with location
        design["items"].append({
            "barcode": barcode,
            "size": size,
            "sizeCode": size_code,
            "locationBin": location_bin,
            "locationCode": loc_code if loc_code else location_bin,
            "srNo": sr_no,
            "status": "available"
        })
        
        # Count sizes
        design["sizes"][size] += 1
        design["totalPieces"] += 1
    
    # Convert defaultdict to list
    inventory_list = []
    for design_no, design in designs.items():
        # Convert sizes dict to proper format
        sizes_dict = {}
        for size, count in design["sizes"].items():
            sizes_dict[size] = count
        
        inventory_list.append({
            "designNo": design["designNo"],
            "productName": design["productName"],
            "color": design["color"],
            "groupType": design["groupType"],
            "gender": design["gender"],
            "totalPieces": design["totalPieces"],
            "sizes": sizes_dict,
            "images": design["images"],
            "items": design["items"]
        })
    
    # Sort by design number
    inventory_list.sort(key=lambda x: x["designNo"])
    
    # Create locations dictionary
    locations = {}
    for design in inventory_list:
        for item in design["items"]:
            if item["locationBin"] not in locations:
                locations[item["locationBin"]] = {
                    "aisle": item["locationBin"].split('-')[0] if '-' in item["locationBin"] else "A",
                    "rack": item["locationBin"].split('-')[1] if '-' in item["locationBin"] else "01",
                    "shelf": item["locationBin"].split('-')[2] if '-' in item["locationBin"] else "001",
                    "currentItem": {
                        "designNo": design["designNo"],
                        "barcode": item["barcode"],
                        "size": item["size"]
                    }
                }
    
    # Save to JSON file
    output_data = {
        "designs": inventory_list,
        "locations": locations,
        "lastUpdated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Conversion Complete!")
    print(f"📦 Total unique designs: {len(inventory_list)}")
    print(f"👕 Total individual items: {sum(d['totalPieces'] for d in inventory_list)}")
    print(f"📍 Total locations: {len(locations)}")
    print(f"🖼️  Designs with images: {sum(1 for d in inventory_list if d['images'])}")
    print(f"💾 Saved to: {output_json_path}")
    
    return output_data

# Run the conversion
if __name__ == "__main__":
    excel_file = "inventory.xlsx"  # Change to your Excel file name
    
    if not os.path.exists(excel_file):
        print(f"❌ Excel file '{excel_file}' not found!")
        print("Please make sure your Excel file is in the same folder.")
    else:
        convert_excel_to_json(excel_file)