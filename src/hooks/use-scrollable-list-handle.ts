import { RefObject, ForwardedRef, useImperativeHandle } from 'react';
import { PartialService, ScrollableListHandle } from '@/types';
import { VListHandle } from 'virtua';
import { Service } from '@/types';

/**
 * Custom hook to handle scrollable list functionality
 */
export const useScrollableListHandle = (
    ref: ForwardedRef<ScrollableListHandle>,
    containerRef: RefObject<HTMLDivElement | null>, // Still useful for general container ref, but not for direct scrolling when VList is active
    virtuaListRef: RefObject<VListHandle | null>,
    services: PartialService[] // Services array for bounds check
) => {
    useImperativeHandle(
        ref,
        () => ({
            scrollToTop: () => {
                // Always use virtuaListRef for scrolling to top if VList is mounted
                virtuaListRef.current?.scrollToIndex(0, {
                    align: 'start',
                    smooth: false
                });
            },
            scrollToIndex: (index: number) => {
                if (index < 0 || index >= services.length) {
                    console.warn(`scrollToIndex called with out-of-bounds index: ${index}`);
                    return;
                }

                if (virtuaListRef.current) {
                    // This is the PRIMARY way to scroll when VList is in use.
                    // VList internally manages the scroll position based on its measurements.
                    virtuaListRef.current.scrollToIndex(index, {
                        align: 'start', // 'start' is usually best for "scroll to this item"
                        smooth: false
                    });
                } else {
                    // This fallback should ideally not be hit if VList is always rendered.
                    // If it is, it indicates VList isn't mounted or not connected properly.
                    // For debugging, you might log a warning here.
                    console.warn("VList ref is not available, falling back to container scroll.");
                    const cardElement = containerRef.current?.querySelector(`[data-service-id="${services[index].id}"]`);
                    if (cardElement && containerRef.current) {
                        // Fallback is also simplified
                        cardElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            }
        }),
        [virtuaListRef, services] // Dependencies should be virtuaListRef and services for accuracy
    );
};