import { Popup } from 'react-map-gl/mapbox';

import type { MarkerDataCluster, PartialService } from '@/types';

import { StackedServicesList } from './stacked-services-list';

type ClusterPopupProps = {
    cluster: MarkerDataCluster;
    onSelect: (service: PartialService) => void;
    onClose: () => void;
};

export const ClusterPopup = ({ cluster, onSelect, onClose }: ClusterPopupProps) => (
    <Popup
        longitude={cluster.longitude}
        latitude={cluster.latitude}
        closeOnClick={false}
        onClose={onClose}
        focusAfterOpen={false}
        maxWidth="none"
    >
        <StackedServicesList services={cluster.services} onSelect={onSelect} />
    </Popup>
);
