import React from 'react';

interface CategoryFiltersProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  categories,
  selectedCategory,
  onSelectCategory
}) => {
  return (
    <section className="categories-wrapper">
      <div className="categories-scroll">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`cat-pill ${cat === selectedCategory ? 'active' : ''}`}
            onClick={() => onSelectCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </section>
  );
};
