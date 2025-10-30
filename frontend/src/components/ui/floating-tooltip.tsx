"use client";

import React, { useState, useRef, useEffect } from 'react';

interface Element {
  element_id: number;
  type: string;
  bbox: number[];
  content: string;
  description: string;
}

interface FloatingTooltipProps {
  children: React.ReactNode;
  elements: Element[];
  onElementHover?: (element: Element | null) => void;
}

interface TooltipState {
  visible: boolean;
  element: Element | null;
  x: number;
  y: number;
}

export function FloatingTooltip({ children, elements, onElementHover }: FloatingTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    element: null,
    x: 0,
    y: 0
  });
  
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Get the actual image element inside the container
    const imgElement = containerRef.current.querySelector('img');
    if (!imgElement) return;

    const imgRect = imgElement.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate relative position within the image
    const relativeX = event.clientX - imgRect.left;
    const relativeY = event.clientY - imgRect.top;

    // Check if mouse is actually over the image
    if (relativeX < 0 || relativeY < 0 || relativeX > imgRect.width || relativeY > imgRect.height) {
      setTooltip(prev => ({ ...prev, visible: false, element: null }));
      onElementHover?.(null);
      return;
    }

    // Calculate the scale factors between displayed image and original image
    const scaleX = imgElement.naturalWidth / imgRect.width;
    const scaleY = imgElement.naturalHeight / imgRect.height;

    // Convert mouse coordinates to original image coordinates
    const imageX = relativeX * scaleX;
    const imageY = relativeY * scaleY;

    // Find element under cursor
    const hoveredElement = elements.find(element => {
      const [left, top, right, bottom] = element.bbox;
      return imageX >= left && imageX <= right && imageY >= top && imageY <= bottom;
    });

    if (hoveredElement) {
      setTooltip({
        visible: true,
        element: hoveredElement,
        x: event.clientX,
        y: event.clientY
      });
      onElementHover?.(hoveredElement);
    } else {
      setTooltip(prev => ({ ...prev, visible: false, element: null }));
      onElementHover?.(null);
    }
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false, element: null }));
    onElementHover?.(null);
  };

  return (
    <>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative cursor-crosshair"
      >
        {children}
      </div>
      
      {tooltip.visible && tooltip.element && (
        <div
          className={`fixed z-50 bg-white border-2 border-purple-300 rounded-lg shadow-xl p-4 pointer-events-none ${
            tooltip.element.type === 'table' 
              ? 'max-w-5xl' 
              : 'max-w-sm max-h-80'
          }`}
          style={{
            maxHeight: tooltip.element.type === 'table' ? '80vh' : '320px',
            left: (() => {
              // Keep tooltip close to cursor, with simple overflow protection
              const offset = 15;
              const minMargin = 20;
              const preferredLeft = tooltip.x + offset;
              
              // Check if tooltip would go off the right edge (rough estimate)
              if (preferredLeft > window.innerWidth - 300) {
                // Position to the left of cursor
                return Math.max(minMargin, tooltip.x - offset - 50);
              }
              return preferredLeft;
            })(),
            top: (() => {
              // Keep tooltip close to cursor, with simple overflow protection
              const offset = -10;
              const minMargin = 20;
              const preferredTop = tooltip.y + offset;
              
              // Check if tooltip would go off the bottom edge (rough estimate)
              if (preferredTop > window.innerHeight - 200) {
                // Position above cursor
                return Math.max(minMargin, tooltip.y - offset - 100);
              }
              return preferredTop;
            })()
          }}
        >
          <div className="flex items-center mb-2">
            <span className={`px-2 py-1 rounded text-xs font-bold mr-2 ${
              tooltip.element.type === 'table' ? 'bg-green-100 text-green-800' :
              tooltip.element.type === 'title' ? 'bg-red-100 text-red-800' :
              tooltip.element.type === 'section_header' ? 'bg-purple-100 text-purple-800' :
              tooltip.element.type === 'figure' ? 'bg-pink-100 text-pink-800' :
              tooltip.element.type === 'page_header' || tooltip.element.type === 'page_footer' ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {tooltip.element.type}
            </span>
            <span className="font-semibold text-gray-700">
              Element #{tooltip.element.element_id}
            </span>
          </div>
          
          {tooltip.element.type === 'figure' ? (
            // For figure elements, show only description (since content = description for figures)
            <div>
              <span className="text-xs font-medium text-gray-600">Description:</span>
              <p className="text-sm text-gray-800">{tooltip.element.description || tooltip.element.content}</p>
            </div>
          ) : tooltip.element.type === 'table' ? (
            // For table elements, show optimized table view
            <div className="space-y-2">
              {tooltip.element.description && (
                <div>
                  <span className="text-xs font-medium text-gray-600">Description:</span>
                  <p className="text-sm text-gray-800 line-clamp-2">{tooltip.element.description}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Table Content:</span>
                  {(() => {
                    // Extract table dimensions from HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(tooltip.element.content, 'text/html');
                    const table = doc.querySelector('table');
                    if (table) {
                      const rows = table.querySelectorAll('tr').length;
                      const cols = table.querySelector('tr')?.querySelectorAll('th, td').length || 0;
                      return <span className="text-purple-600 font-medium text-xs">📊 {rows}×{cols} table</span>;
                    }
                    return null;
                  })()}
                </div>
                
                {/* Auto-sized table container with overflow safety */}
                <div className="border rounded p-3 bg-gray-50 overflow-auto">
                  <div 
                    dangerouslySetInnerHTML={{ __html: tooltip.element.content }}
                    className="text-xs table-tooltip-content [&_table]:border-collapse [&_table]:w-full [&_table]:min-w-max [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-gray-100 [&_th]:font-bold [&_th]:text-left [&_th]:whitespace-nowrap [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:whitespace-nowrap [&_tr:nth-child(even)]:bg-white [&_td]:hover:bg-yellow-100 [&_th]:text-gray-700"
                    style={{ fontSize: '11px', lineHeight: '1.3' }}
                  />
                </div>
                
                {/* Table info */}
                <div className="text-xs text-gray-500 mt-2 text-center">
                  💡 Auto-sized to fit complete table content
                </div>
              </div>
            </div>
          ) : (
            // For all other elements, show description and content separately
            <div className="space-y-2">
              {tooltip.element.description && (
                <div>
                  <span className="text-xs font-medium text-gray-600">Description:</span>
                  <p className="text-sm text-gray-800">{tooltip.element.description}</p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-gray-600">Content:</span>
                <div className="text-sm text-gray-800 max-h-32 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {tooltip.element.content.length > 200 
                      ? `${tooltip.element.content.substring(0, 200)}...` 
                      : tooltip.element.content
                    }
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}