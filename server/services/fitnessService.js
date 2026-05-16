const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

let dfFood = [];
let dfWorkout = [];

// Helper: Parse numerical ranges (e.g., "200-300" -> 250)
const parseRange = (val) => {
    if (typeof val === 'string') {
        val = val.replace('–', '-').trim();
        if (val.includes('-')) {
            const parts = val.split('-').map(v => parseFloat(v));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return (parts[0] + parts[1]) / 2;
            }
        }
    }
    const num = parseFloat(val);
    return isNaN(num) ? 0.0 : num;
};

// Helper: Categorize Muscles
const getWorkoutCategory = (muscle) => {
    const m = String(muscle).toLowerCase();
    const categories = {
        'Push': ['chest', 'pectoralis', 'tricep', 'deltoid', 'push', 'press', 'shoulder'],
        'Pull': ['back', 'lat', 'rhomboid', 'bicep', 'trap', 'pull', 'row'],
        'Legs': ['quad', 'glute', 'hamstring', 'leg', 'calf', 'adductor'],
        'Core': ['abs', 'core', 'oblique'],
        'Cardio': ['cardio', 'hiit', 'sprint']
    };

    for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(k => m.includes(k))) return cat;
    }
    return 'Other';
};

// Helper: Load CSV Data
const loadFitnessData = () => {
    return new Promise((resolve, reject) => {
        const foodPath = path.join(__dirname, '..', 'food.csv');
        const workoutPath = path.join(__dirname, '..', 'workout.csv');

        const foodPromise = new Promise((res) => {
            const results = [];
            if (!fs.existsSync(foodPath)) {
                console.warn(`Warning: ${foodPath} not found.`);
                return res([]);
            }
            fs.createReadStream(foodPath)
                .pipe(csv())
                .on('data', (data) => {
                    data['Calories (kcal)'] = parseRange(data['Calories (kcal)']);
                    data['Protein (g)'] = parseRange(data['Protein (g)']);
                    data['Carbs (g)'] = parseRange(data['Carbs (g)']);
                    data['Fat (g)'] = parseRange(data['Fat (g)']);

                    let type = (data['Type'] || '').trim().toLowerCase();
                    if (type === 'snacks') type = 'snack';
                    data['Type'] = type.charAt(0).toUpperCase() + type.slice(1); // Title Case

                    const nonVegKeywords = ['chicken', 'egg', 'fish', 'mutton', 'prawn', 'meat', 'beef', 'pork', 'ham', 'bacon'];
                    const dishName = (data['Dish Name'] || '').toLowerCase();
                    data['Is_Veg'] = !nonVegKeywords.some(k => dishName.includes(k));

                    if (data['Calories (kcal)'] > 0) results.push(data);
                })
                .on('end', () => res(results));
        });

        const workoutPromise = new Promise((res) => {
            const results = [];
            if (!fs.existsSync(workoutPath)) {
                console.warn(`Warning: ${workoutPath} not found.`);
                return res([]);
            }
            fs.createReadStream(workoutPath)
                .pipe(csv())
                .on('data', (data) => {
                    data['Category'] = getWorkoutCategory(data['Target Muscle']);
                    results.push(data);
                })
                .on('end', () => res(results));
        });

        Promise.all([foodPromise, workoutPromise]).then(([food, workout]) => {
            dfFood = food;
            dfWorkout = workout;
            console.log(`Loaded ${dfFood.length} food items and ${dfWorkout.length} exercises.`);
            resolve({ foodCount: dfFood.length, workoutCount: dfWorkout.length });
        }).catch(reject);
    });
};

// Helper: Random Sample
const sample = (arr, n = 1) => {
    if (!arr || arr.length === 0) return [];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
};

// Diet Generation Logic
const generateDietDay = (targetCalories, isVeg, schedule) => {
    const mealPools = {
        'Breakfast': dfFood.filter(f => f.Type === 'Breakfast' && (isVeg ? f.Is_Veg : true)),
        'Lunch': dfFood.filter(f => f.Type === 'Lunch' && (isVeg ? f.Is_Veg : true)),
        'Dinner': dfFood.filter(f => f.Type === 'Dinner' && (isVeg ? f.Is_Veg : true)),
        'Snack': dfFood.filter(f => f.Type === 'Snack' && (isVeg ? f.Is_Veg : true))
    };

    for (let i = 0; i < 50; i++) {
        try {
            let selection = {};
            let rawCals = 0;

            for (const [slot, typeKey] of schedule) {
                const pool = mealPools[typeKey];
                if (!pool || pool.length === 0) continue;

                const item = sample(pool, 1)[0];
                selection[slot] = item;
                rawCals += item['Calories (kcal)'];
            }

            if (rawCals > 0) {
                const scaler = targetCalories / rawCals;
                if (scaler >= 0.5 && scaler <= 3.0) {
                    const finalDay = {};
                    let totalCals = 0;

                    for (const [slot, item] of Object.entries(selection)) {
                        const cals = item['Calories (kcal)'] * scaler;
                        totalCals += cals;

                        finalDay[slot] = {
                            "Dish": item['Dish Name'],
                            "Portion": `${scaler.toFixed(2)}x serving`,
                            "Calories": Math.round(cals),
                            "Macros": {
                                "P": Math.round(item['Protein (g)'] * scaler),
                                "C": Math.round(item['Carbs (g)'] * scaler),
                                "F": Math.round(item['Fat (g)'] * scaler)
                            }
                        };
                    }
                    finalDay['Total_Calories'] = Math.round(totalCals);
                    return finalDay;
                }
            }
        } catch (err) {
            continue;
        }
    }
    return { "Error": "Could not generate plan" };
};

// Workout Generation Logic
const getExercises = (category, genderBias, count = 2) => {
    let pool = dfWorkout.filter(w => w.Category === category);

    if (genderBias === 'Male') {
        pool = pool.filter(w => !String(w['Gender/Goal Bias']).toLowerCase().includes('female'));
    } else if (genderBias === 'Female') {
        pool = pool.filter(w => !String(w['Gender/Goal Bias']).toLowerCase().includes('male'));
    }

    if (pool.length === 0) return [];

    const items = sample(pool, Math.min(count, pool.length));

    return items.map(i => ({
        "Exercise": i['Exercise Name'],
        "Sets_Reps": category !== 'Cardio' ? "3x8-12" : "20-30 mins",
        "Target": i['Target Muscle'],
        "Equipment": i['Gym Equipment']
    }));
};

const generateWorkoutWeekLogic = (daysPerWeek, gender, goal) => {
    const schedule = {};
    let split = [];
    let focus = {};

    if (daysPerWeek === 3) {
        split = ['Full Body', 'Rest', 'Full Body', 'Rest', 'Full Body', 'Rest', 'Rest'];
        focus = { 'Full Body': ['Push', 'Pull', 'Legs', 'Core'] };
    } else if (daysPerWeek === 5) {
        split = ['Chest/Tri', 'Back/Bi', 'Legs', 'Shoulders', 'Arms/Core', 'Active Rest', 'Rest'];
        focus = {
            'Chest/Tri': ['Push'], 'Back/Bi': ['Pull'], 'Legs': ['Legs'],
            'Shoulders': ['Push'], 'Arms/Core': ['Pull', 'Core']
        };
    } else {
        split = ['Upper A', 'Lower A', 'Rest', 'Upper B', 'Lower B', 'Active Rest', 'Rest'];
        focus = {
            'Upper A': ['Push', 'Pull'], 'Upper B': ['Push', 'Pull'],
            'Lower A': ['Legs', 'Core'], 'Lower B': ['Legs', 'Core'],
            'Active Rest': ['Cardio'], 'Rest': []
        };
    }

    split.forEach((dayType, index) => {
        const dayName = `Day_${index + 1}_${dayType.replace(' ', '_')}`;

        if (dayType === 'Rest') {
            schedule[dayName] = { "Type": "Rest", "Exercises": [] };
            return;
        }

        const categories = focus[dayType] || ['Cardio'];
        let dailyWorkout = [];

        categories.forEach(cat => {
            if (cat === 'Cardio' || (String(goal).includes('Loss') && dailyWorkout.length > 3)) {
                dailyWorkout = [...dailyWorkout, ...getExercises('Cardio', gender, 1)];
            } else {
                dailyWorkout = [...dailyWorkout, ...getExercises(cat, gender, 2)];
            }
        });

        schedule[dayName] = {
            "Type": dayType,
            "Exercises": dailyWorkout
        };
    });

    return schedule;
};

const generateDietPlan = (tdee, goal, isVeg) => {
    const isGain = goal.toLowerCase().includes('gain');
    const target = isGain ? tdee + 500 : tdee - 500;

    let schedule = [
        ['Breakfast', 'Breakfast'], ['Snack_1', 'Snack'],
        ['Lunch', 'Lunch'], ['Snack_2', 'Snack'], ['Dinner', 'Dinner']
    ];
    if (isGain) schedule.push(['Bedtime_Snack', 'Snack']);

    const plan = {};
    for (let w = 1; w <= 1; w++) {
        plan[`Week_${w}`] = {};
        for (let d = 1; d <= 7; d++) {
            plan[`Week_${w}`][`Day_${d}`] = generateDietDay(target, isVeg, schedule);
        }
    }

    return {
        "User": { "Goal": goal, "Target": target },
        "Diet_Plan": plan
    };
};

const generateWorkoutPlan = (gender, goal, days) => {
    if (dfWorkout.length === 0) throw new Error("workout.csv not found or empty");

    const plan = {};
    for (let w = 1; w <= 1; w++) {
        plan[`Week_${w}`] = generateWorkoutWeekLogic(days, gender, goal);
    }

    return {
        "User": { "Gender": gender, "Goal": goal, "Days": days },
        "Workout_Plan": plan
    };
};

module.exports = {
    loadFitnessData,
    generateDietPlan,
    generateWorkoutPlan
};
