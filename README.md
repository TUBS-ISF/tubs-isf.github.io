# ISF Literature Surveys

A web platform providing interactive literature surveys on software product lines.

## Website
https://tubs-isf.github.io/

## Features 
- Landing page with overview of available surveys.
- Interactive tables of literature surveys with filtering options.
- Literature surveys:
    - **Product Line Analyses** - Analyses Strategies for Software Product Lines.
    - **Sampling** - Product Sampling for Software Product Lines.
    - **Tertiary Study PLA** - A Collection of Literature Surveys on SPL Research.

## Setup

### Requirements:
- [Node.js](https://nodejs.org/en)
- npm (included with Node.js)

### Clone the repository:

```bash
git clone https://github.com/TUBS-ISF/tubs-isf.github.io.git
cd tubs-isf.github.io
```

### Install dependencies:
```bash
npm install
```
### To update vendor files:
```bash
bash update-vendor.sh
```
## Run Locally

Make sure your terminal is in the root of the project (where `index.html` is located).

Start a local development server with live reload: 

```bash
npx live-server .
```
This will open the project in your browser and automatically reload the page whenever you make changes.


**Alternative (if you don't have Node.js / npm)**

You can also use Python to start a simple server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

**Tip:** If changes are not reflected, refresh your browser. In some cases, you may need to clear your browser cache.

## Project Structure

```
.
├─ css
│  ├─ vendor/               # copied CSS libraries
│  └─ styles.css        
├─ img
│  ├─ chevron-down.svg
│  └─ logo_ISF.svg
├─ js
│  ├─ vendor/               # copied JS libraries
│  └─ script.js
├─ node_modules             # npm dependencies (ignored)
├─ pl-analyses
│  ├─ data
│  │  └─ literature.csv
│  └─ index.html
├─ pl-sampling
│  ├─ data
│  │  └─ literature.csv
│  └─ index.html
├─ pl-surveys
│  ├─ data
│  │  └─ literature.csv
│  └─ index.html
├─ index.html
├─ package-lock.json
├─ package.json
└─ update-vendor.sh
```



## Adding a New Survey

To create a new literature survey page:

1. **Create a new folder** in the root directory, e.g., `pl-new-survey/`.
2. **Add a CSV file** with the literature data inside: `pl-new-survey/data/literature.csv`.
   - Make sure the file is named exactly `literature.csv`.
3. **Add an** `index.html` **file** in the new folder.  
   - You can copy an existing survey page (e.g., `pl-surveys/index.html`) as a template.  
   - Make sure to include the necessary CSS and JS references, just like in the other surveys.
4. **Link your new page** from the landing page by adding a new card in `index.html`.
5. **Update the README.md** to reflect the changes you made, if applicable.

### Excluding Columns from Search Dropdowns
Some columns in the CSV should **not appear in the search/filter dropdowns**.  
This is configured in `js/script.js`:

```javascript
    const columnsWithoutSearch = [
        // All literature surveys
        "Year",     
        
        // PL-Surveys                    
        "Category",
        
        // PL-Analyses                     
        "SE Layer",
        "Specification Strategy",      
        
        // PL-Sampling               
        "Input Data",                   
        "Algorithm Category",           
        "Coverage",                     
        "Evaluation",
        "Application",              
    ];                  
    const shouldShowSearch = !columnsWithoutSearch.includes(columnTitle.trim());
    createMultiSelect(container, allValues, column, shouldShowSearch);
```
- Add column names as needed.
- Columns listed here will not have search functionality in the dropdowns.

## Updating Libraries

To update dependencies: 
```bash
npm update 
bash update-vendor.sh
```

## Libraries

- Bootstrap 5
- DataTables
- jQuery
- PapaParse