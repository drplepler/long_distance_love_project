# Long Distance Love ❤️

A romantic scroll-based animation showing a plane flying from Amsterdam to Haifa.

## Setup

1. Add your world map image as `map.jpg` in the root directory
2. Adjust the city coordinates in `script.js` to match your map:
   - `amsterdamCoords = { x: 48, y: 30 }` (percentage position)
   - `haifaCoords = { x: 58, y: 45 }` (percentage position)

## GitHub Pages Deployment

1. Create a new GitHub repository named `long_distance_proj`
2. Push these files to the repository
3. Go to repository Settings → Pages
4. Under "Build and deployment", select "Deploy from a branch"
5. Choose `main` branch and `/ (root)` folder
6. Click Save
7. Your site will be available at: `https://yourusername.github.io/long_distance_proj/`

## Customization

- Add your romantic content in the `.content-section` divs in `index.html`
- Modify colors in `styles.css` (currently purple gradient)
- Adjust scroll length by adding/removing `.content-section` elements
- Change plane animation speed by modifying the scroll calculation in `script.js`
